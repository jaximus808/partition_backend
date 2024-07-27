import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import bcrpyt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { Router } from 'express'

import google_signup from '../route_schemas/google_signup'
import token_check from '../route_schemas/token_check'

const router = Router()



router.post("/register_user", google_signup, async (req, res)=>
{
    const userOb = req.body

    const hashed_google_id = await bcrpyt.hash(userOb.google_id, 10)

    try{
        const user = await prisma.user.create({
            data:{
                email:userOb.email,
                username:userOb.displayName,
                google_id: hashed_google_id,
                
            }
        })   
        const secret = process.env.JWT_SECRET 
        if(!secret)
        {
            res.send({success:false, jwt: ""})
            return
        }
        const token = jwt.sign({email: user.email}, secret)
        res.send({success:true, jwt:token})
    }
    catch(e)
    {
        res.send({success:false, jwt: ""})
    }
})

router.post("/check_token", token_check,async (req, res)=>
    {
        const token = req.body.token
        const secret = process.env.JWT_SECRET  
        if(!secret)
        {
            res.send({success:false})
            return
        }
        

        try{
            const user_email = await jwt.verify(token, secret) as string
            const user = await prisma.user.findUnique({
                where:{
                    email:user_email
                }
            })
            if(!user)
            {
                res.send({success:false}) 
            }
            else 
            {
                let loginStatus = 2
                if(user.plaid_id.length == 0)
                {
                    loginStatus = 1
                }
                res.send({success:true,loginStatus:loginStatus, username:user.username}) 
            }
            
        }
        catch(e)
        {
            res.send({success:false})
        }
    })