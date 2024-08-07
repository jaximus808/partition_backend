import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import bcrpyt from 'bcrypt'
import jwt, { JwtPayload } from 'jsonwebtoken'

import  { NextFunction, Request, Response } from "express";

const JwtTokenCheck = (req:Request, res:Response, next:NextFunction)=>
{   
    
    
}

export default JwtTokenCheck