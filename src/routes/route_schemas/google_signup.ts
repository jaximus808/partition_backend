
import { Router, Request, Response, NextFunction } from 'express';
import Joi from "joi";

const schema = Joi.object({
    email: Joi.string().email().required(),
    google_id: Joi.string().required(),
    displayName: Joi.string().required()
})

const validator = async (req:Request, res:Response, next:NextFunction) =>
{
    try {
        const value = await schema.validateAsync(req.body);
        next()
    }
    catch (err) {
        res.send({success:false,jwt:"", error:0})
     }
    
}

export default validator