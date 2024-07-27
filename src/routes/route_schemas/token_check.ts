
import { Router, Request, Response, NextFunction } from 'express';
import Joi from "joi";

const schema = Joi.object({
    token: Joi.string().required(),
})

const validator = async (req:Request, res:Response, next:NextFunction) =>
{
    try {
        const value = await schema.validateAsync(req.body);
        next()
    }
    catch (err) {
        res.send({success:false})
     }
    
}

export default validator