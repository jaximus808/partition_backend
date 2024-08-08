
import { Configuration, PlaidApi, Products, PlaidEnvironments,CountryCode} from 'plaid';
import util from 'util';
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import moment from 'moment';
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

const client = new PlaidApi(config)

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
        const createTokenResponse = await client.linkTokenCreate(configs);
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

router.post("/get_transactions", (req, res) =>
{
    
})

export default router