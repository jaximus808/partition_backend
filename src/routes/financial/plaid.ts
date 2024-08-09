
import { Configuration, PlaidApi, Products, PlaidEnvironments,CountryCode, TransactionsSyncRequest, Transaction} from 'plaid';
import util from 'util';
import { Router, Request, Response } from 'express';
import { PrismaClient,Prisma } from '@prisma/client'
const prisma = new PrismaClient()
// import {Prisma} from '@prisma/client'
import plaid_setup from '../route_schemas/plaid_setup_check'

import plaid_fin from '../route_schemas/plaid_fin_check'
import plaid_tran_update from '../route_schemas/plaid_tran_update'
const router = Router()

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

const PLAID_COUNTRY_CODES = [CountryCode.Us]

const PLAID_REDIRECT_URI = process.env.PLAID_REDIRECT_URI || '';

const PLAID_ANDROID_PACKAGE_NAME = process.env.PLAID_ANDROID_PACKAGE_NAME || '';

import jwt, { JwtPayload } from 'jsonwebtoken'
//import { JsonArray } from '@prisma/client/runtime/library';
const PLAID_PRODUCTS = [Products.Auth,Products.Transactions]


let ACCESS_TOKEN:string|null = null
let PUBLIC_TOKEN:string|null = null
let ITEM_ID:string|null = null
let ACCOUNT_ID:string|null = null

let PAYMENT_ID = null;
let AUTHORIZATION_ID = null;
let TRANSFER_ID = null;


const prettyPrintResponse = (response:any) => {
    console.log(util.inspect(response.data, { colors: true, depth: 4 }));
  };
  
  

const config = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: {
        headers:{
            'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
            'PLAID-SECRET': PLAID_SECRET,
            'Plaid-Version': '2020-09-14'
        }
    }
})

const plaidClient = new PlaidApi(config)

// router.post('/api/info', (req, res)=>
// {
//     res.json({
//         item_id:ITEM_ID,
//         access_token:ACCESS_TOKEN,
//         products:PLAID_PRODUCTS,
//     })
// })

router.post('/create_link_token', async (request, response, next) => {
    console.log("CONECTEF!")
    if(!request.body.token)
    {
        response.json({
            success:false
        })
        return
    }
    try
    {
        
        const token = request.body.token
        const secret = process.env.JWT_SECRET  
        if(!secret)
        {
            throw "erro";
        }
        const user_email = await jwt.verify(token, secret  ) as JwtPayload
    
        const user = await prisma.user.findUnique({
            where:{
                email:user_email.email
            }
        })
        if(!user)
        {
            response.send({success:false}) 
            return
        }
        const clientId = user.id
        Promise.resolve()
        .then(async function () {
        const configs = {
            user: {
            // This should correspond to a unique id for the current user.
            client_user_id: clientId
            },
            client_name: 'Plaid Quickstart',
            products: PLAID_PRODUCTS,
            country_codes: PLAID_COUNTRY_CODES,
            language: 'en',
        };
    
        // if (configs.redirect_uri  !== '') {
        //   configs.redirect_uri = PLAID_REDIRECT_URI;
        // }
    
        // if (PLAID_ANDROID_PACKAGE_NAME !== '') {
        //   configs.android_package_name = PLAID_ANDROID_PACKAGE_NAME;
        // }
        // if (PLAID_PRODUCTS.includes(Products.Statements)) {
        //   const statementConfig = {
        //     end_date: moment().format('YYYY-MM-DD'),
        //     start_date: moment().subtract(30, 'days').format('YYYY-MM-DD'),
        //   }
        //   configs.statements = statementConfig;
        // }
        console.log("HEE")
        const createTokenResponse = await plaidClient.linkTokenCreate(configs);
        prettyPrintResponse(createTokenResponse);
        response.json(createTokenResponse.data);
        })
        .catch((e)=>
        {
            console.log(e)
            response.send({success:false}) 
        });

    }
    catch (e)
    {
        response.send({success:false}) 
    }

});


router.post("/setup_plaid", plaid_setup, async(req, res)=>
    {
        console.log("got it")
        const token = req.body.user_jwt
        const publicToken = req.body.public_token
        const jwt_secret = process.env.JWT_SECRET  
        const secret = process.env.SERVER_PLAID_SECRET  
        if(!secret || !jwt_secret)
        {
            res.send({success:false, error:4})
            return
        }
        try 
        {
            const user_email =  jwt.verify(token, jwt_secret  ) as JwtPayload
        
            const user = await prisma.user.findUnique({
                where:{
                    email:user_email.email
                }
            })
            if(!user)
            {
                res.send({success:false, error: 1}) 
                return
            }
            if(user.plaid_token != "")
            {
                res.send({success:false, error: 2})
                return
            }
            const access_token = await plaidClient.itemPublicTokenExchange({
                public_token: publicToken,
              });
            const encrypt_token = jwt.sign(access_token.data.access_token, secret)
           
            await prisma.user.update({
                where:{
                    email:user_email.email
                },
                data:{
                    plaid_token:encrypt_token,
                    // uncategorized_transcation_30days: JSON.stringify(transactions.data.added)
                }
            })

            res.send({success:true})
    
        }
        catch (e)
        {
            console.log(e)
    
            res.send({success:false,error:5})
        }
        
    })

router.post("/get_transactions",plaid_fin, async (req, res) =>
{
    const token = req.body.user_jwt
    const jwt_secret = process.env.JWT_SECRET  
    const secret = process.env.SERVER_PLAID_SECRET  
    if(!secret || !jwt_secret)
    {
        res.send({success:false, error:4})
        return
    }
    try 
    {
        const user_email =  jwt.verify(token, jwt_secret  ) as JwtPayload
        console.log(user_email)
        const user = await prisma.user.findUnique({
            where:{
                email:user_email.email
            }
        })
        if(!user)
        {
            res.send({success:false, error: 1}) 
            return
        }

        if(user.plaid_token.length == 0)
        {
            res.send({success:false, error: 2})
            return
        }
        
        const access_token =  jwt.verify(user.plaid_token, secret) as string
       
        const syncObject:TransactionsSyncRequest = 
        {
            access_token: access_token,
            client_id: user.id,
            options:{
                days_requested:30,
            }
        }
        
        if(user.plaid_cursor.length>0)
        {
            syncObject.cursor = user.plaid_cursor
        }

        const transactions = await plaidClient.transactionsSync(syncObject)

        if(!transactions)
        {
            throw "something went wrong"
        }

        if(transactions.data.added.length > 0)
        {
            const parsed_added_tran = []
            const parsed_added_income = []
    
            for(let i = 0; i < transactions.data.added.length; i++)
            {
                const tran = transactions.data.added[i]
                if(tran.amount<0)
                {
                    parsed_added_income.push(tran)
                    continue
                }
                parsed_added_tran.push(tran)
            }
            parsed_added_tran.reverse()
            parsed_added_income.reverse()
            // console.log(parsed_added_tran)
            const new_uncat_tran = user.uncategorized_transaction_30days as Array<any>
            const new_income_tran = user.income_transaction_30days as Array<any>
            new_uncat_tran.push(...parsed_added_tran)
            new_income_tran.push(...parsed_added_income)
            
            
            await prisma.user.update({
                where:{
                    email:user_email.email
                },
                data:{
                    uncategorized_transaction_30days: new_uncat_tran,
                    plaid_cursor: transactions.data.next_cursor,
                    income_transaction_30days: new_income_tran
                    
                }
            })
            
            res.send({
                success:true, 
    
                uncat_transactions: new_uncat_tran, 
    
                want_transactions: user.want_transaction_30days, 
    
                need_transactions: user.need_transaction_30days,
    
                invest_transactions: user.investment_transaction_30days,

                income_transactions: new_income_tran,
                
                plaid_cursor:transactions.data.next_cursor,
            })
        }
        else
        {
          
            console.log("sent")
            // console.log(JSON.parseuser.uncategorized_transaction_30days?.toString())
            res.send({
                success:true, 
    
                uncat_transactions: user.uncategorized_transaction_30days, 
    
                want_transactions: user.want_transaction_30days, 
    
                need_transactions: user.need_transaction_30days,
    
                invest_transactions: user.investment_transaction_30days,

                income_transactions: user.income_transaction_30days,
                plaid_cursor: user.plaid_cursor
            })
        }
    }
    catch (e)
    {
        console.log(e)
        
        res.send({success:false,error:5})
    }
})


router.post("/set_transaction", plaid_tran_update, async (req, res) =>{
    const token = req.body.user_jwt
    const jwt_secret = process.env.JWT_SECRET  
    const plaid_cursor = req.body.plaid_cursor
    const category = req.body.category
    if( !jwt_secret)
    {
        res.send({success:false, error:4})
        return
    }
    try 
    {
        const user_email =  jwt.verify(token, jwt_secret  ) as JwtPayload
        
        const user = await prisma.user.findUnique({
            where:{
                email:user_email.email
            }
        })
        if(!user)
        {
            res.send({success:false, error: 1}) 
            return
        }
        if(user.plaid_cursor != plaid_cursor)
        {
            //this mean the user was updated through a webhook
            
            res.send({
                success:false, 
                
                error: -2, 
                
                new_uncat_trans:user.uncategorized_transaction_30days, 
                
                new_plaid_cursor: user.plaid_cursor 
            }) 
            return
        }
        const uncat_array = user.uncategorized_transaction_30days as Array<any>;
        const up_trans = uncat_array.shift();
        switch(category)
        {
            case "want":

            console.log("WANT")
                const want_array = user.want_transaction_30days as Array<any>;
                want_array.unshift(up_trans);
                //console.log(want_array)
                await prisma.user.update({
                    where:{
                        email:user_email.email
                    },
                    data:{
                        uncategorized_transaction_30days:uncat_array,
                        want_transaction_30days:want_array
                    }
                })
                break;
            case "need":

            console.log("NEED")
                const need_array = user.need_transaction_30days as Array<any>;
                need_array.unshift(up_trans);
                //console.log(need_array)
                await prisma.user.update({
                    where:{
                        email:user_email.email
                    },
                    data:{
                        uncategorized_transaction_30days:uncat_array,
                         need_transaction_30days:need_array
                    }
                })
                break;
            case "invest":
                console.log("INVEST")
                const invest_array = user.investment_transaction_30days as Array<any>;
                invest_array.unshift(up_trans);
                await prisma.user.update({
                    where:{
                        email:user_email.email
                    },
                    data:{
                        uncategorized_transaction_30days:uncat_array,
                        investment_transaction_30days:invest_array
                    }
                })
                break;
        }
        res.send({success:true})
    }
    catch(e)
    {
        console.log(e)

        res.send({success:false,error:5})
    }
})

export default router