
import { Configuration, PlaidApi, Products, PlaidEnvironments,CountryCode, TransactionsSyncRequest, Transaction} from 'plaid';
import util from 'util';
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import plaid_setup from '../route_schemas/plaid_setup_check'

import plaid_fin from '../route_schemas/plaid_fin_check'
const router = Router()

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

const PLAID_COUNTRY_CODES = [CountryCode.Us]

const PLAID_REDIRECT_URI = process.env.PLAID_REDIRECT_URI || '';

const PLAID_ANDROID_PACKAGE_NAME = process.env.PLAID_ANDROID_PACKAGE_NAME || '';

import jwt, { JwtPayload } from 'jsonwebtoken'
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
        console.log("MEOW")
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
        
        console.log("anoo3")
        if(user.plaid_cursor.length>0)
        {
            syncObject.cursor = user.plaid_cursor
        }

        const transactions = await plaidClient.transactionsSync(syncObject)

        console.log("anoo4")
        console.log("MEOW!!")
        if(!transactions)
        {
            throw "something went wrong"
        }
        console.log(transactions.data.added)



        if(transactions.data.added.length > 0)
        {
            let new_income = 0

            const parsed_added_tran = []
    
            for(let i = 0; i < transactions.data.added.length; i++)
            {
                const tran = transactions.data.added[i]
                if(tran.amount<0)
                {
                    new_income -= tran.amount 
                    continue
                }
                parsed_added_tran.push(tran)
            }
    
            const new_uncat_tran = user.uncategorized_transaction_30days as Array<any>
            new_uncat_tran.push(transactions.data.added)
            console.log(new_uncat_tran)
            
    
            await prisma.user.update({
                where:{
                    email:user_email.email
                },
                data:{
                    uncategorized_transaction_30days: JSON.stringify(new_uncat_tran),
                    plaid_cursor: transactions.data.next_cursor,
                    total_income_30days: user.total_income_30days+new_income
                    
                }
            })
            
            console.log("sent")
            res.send({
                success:true, 
    
                uncat_transactions: new_uncat_tran, 
    
                want_transaction: user.want_transaction_30days, 
    
                need_transaction: user.need_transaction_30days,
    
                invest_transaction: user.investment_transaction_30days,

                total_income: user.total_income_30days+new_income
            })
        }
        else
        {
          
            console.log("sent")
            res.send({
                success:true, 
    
                uncat_transactions:[], 
    
                want_transaction: user.want_transaction_30days, 
    
                need_transaction: user.need_transaction_30days,
    
                invest_transaction: user.investment_transaction_30days,

                total_income: user.total_income_30days
            })
        }

        

    }
    catch (e)
    {
        console.log(e)

        res.send({success:false,error:5})
    }
})

export default router