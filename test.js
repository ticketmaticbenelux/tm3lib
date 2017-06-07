'use strict'

const env = require('node-env-file')
env(__dirname + '/.env')

const lib = require("./index.js")
        
const client = {
	shortname: process.env.SHORTNAME,
	key: process.env.API_KEY,
	secret: process.env.API_SECRET
}

/*
lib.updateOrderField(client, 1002, "invoiceurl", "http://www.ticketmatic.com")

lib.getOrderField(client, 1002, "invoiceurl")
.then(console.log)

lib.sendDelivery(client, 10002, 1002)
*/