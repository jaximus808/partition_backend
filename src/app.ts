require('dotenv').config();

import finicialRouter from "./routes/financial/plaid"
import userAuthRouter from "./routes/user/user_auth"

import express, { Request, Response } from "express";
import bodyParser from 'body-parser';
import cors from 'cors';

const APP_PORT = process.env.APP_PORT || 3000;


const app = express()

app.use(bodyParser.urlencoded({extended:false}))

app.use(bodyParser.json())
app.use(cors())

app.get("/",(req:Request, res: Response)=>
{
  res.send("hi")
})

app.use("/api/fin",finicialRouter)
app.use("/api",userAuthRouter)

const server = app.listen(APP_PORT, function () {
    console.log('plaid-quickstart server listening on port ' + APP_PORT);
});