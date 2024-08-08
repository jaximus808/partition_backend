import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import bcrpyt from 'bcrypt'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Router } from 'express'

import google_signup from '../route_schemas/google_signup'
import token_check from '../route_schemas/token_check'
const router = Router()



router.post("/register_user_google", google_signup, async (req, res)=>
{
    const userOb = req.body

    const hashed_google_id = await bcrpyt.hash(userOb.google_id, 10)

    

    try{

        const check_email = await prisma.user.findUnique({
            where:{
                email:userOb.email
            }
        })
        if (check_email != null)
        {
            //lowkey should log them in
            res.send({success:false, jwt: "", error:1})
            return
        }

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
            res.send({success:false, jwt: "", error:0})
            return
        }
        const token = jwt.sign({email: user.email}, secret)
        res.send({success:true, jwt:token, error:0})
        
    }
    catch(e)
    {
        res.send({success:false, jwt: "", error:0})
    }
})



router.post("/signin_user_google", google_signup, async (req, res)=>
    {
        const userOb = req.body

    
        try{
    
            const check_email = await prisma.user.findUnique({
                where:{
                    email:userOb.email
                }
            })
            const secret = process.env.JWT_SECRET 
            //user doesn't exist, sign them up
            if (!check_email)
            {

                const hashed_google_id = await bcrpyt.hash(userOb.google_id, 10)
                const user = await prisma.user.create({
                    data:{
                        email:userOb.email,
                        username:userOb.displayName,
                        google_id: hashed_google_id,
                        
                    }
                })   
                
            
                if(!secret)
                {
                    res.send({success:false, jwt: "", error:0})
                    return
                }
                const token = jwt.sign({email: user.email}, secret)
                res.send({success:true, jwt:token, error:3})
                return 
            }
    
            if(!secret)
            {
                res.send({success:false, jwt: "", error:0})
                return
            }
            let loginStatus = 2
            if(check_email.plaid_token.length == 0)
            {
                loginStatus = 1
            }
          
            const token = jwt.sign({email: check_email.email}, secret)
            res.send({success:true, jwt:token, error:0, page:loginStatus})
            
        }
        catch(e)
        {
            res.send({success:false, jwt: "", error:0})
        }
    })

router.post("/check_token", token_check,async (req, res)=>
{
    const token = req.body.token
    const secret = process.env.JWT_SECRET  
    console.log(token)
    if(!secret)
    {
        res.send({success:false, loginStatus:0, username:""})
        return
    }

    try{
        const user_email = await jwt.verify(token, secret) as JwtPayload
        console.log(user_email)
        const user = await prisma.user.findUnique({
            where:{
                email:user_email.email
            }
        })
        if(!user)
        {
            res.send({success:false,loginStatus:0,username:""}) 
        }
        else 
        {
            let loginStatus = 2
            if(user.plaid_token.length == 0)
            {
                loginStatus = 1
            }
            console.log(loginStatus)
            res.send({success:true,loginStatus:loginStatus, username:user.username}) 
        }
        
    }
    catch(e)
    {
        res.send({success:false,loginStatus:0,username:""})
    }
})


export default router