require('dotenv').config();

import finicialRouter from "./routes/financial/plaid"

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

app.use(finicialRouter)

const server = app.listen(APP_PORT, function () {
    console.log('plaid-quickstart server listening on port ' + APP_PORT);
});