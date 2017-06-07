'use strict'

const env = require('node-env-file')
env(__dirname + '/.env')

const 
    R = require("ramda"),
    Promise = require("bluebird"),
    lib = require("./index.js")
        
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

/*
const addInvoiceUrlToOrders = (client, documentid) => {
    const getOrdersWithoutInvoiceURL = client => lib.api.query(client, `select id from tm.order where c_invoiceneeded and not c_invoicesent and (c_invoiceurl is null or c_invoiceurl = '')`).then(R.pluck("id"))
    const handleOrder = orderid => lib.getDocumentUrl(client, documentid, orderid).then(lib.updateOrderField(client, orderid, "invoiceurl"))
    return getOrdersWithoutInvoiceURL(client)
    .then(orders => Promise.mapSeries(orders, handleOrder))
}

const sendInvoices = (client, mailtemplateid) => {
    const getOrders = client => lib.api.query(client, `select id from tm.order where c_invoiceneeded and not c_invoicesent and c_invoiceurl is not null and c_invoiceurl <> ''`).then(R.pluck("id"))
    const handleOrder = orderid => lib.sendDelivery(client, mailtemplateid, orderid).then(lib.updateOrderField(client, orderid, "invoicesent", true))
    return getOrders(client)
    .then(orders => Promise.mapSeries(orders, handleOrder))
}

const documentid = 10000
const mailtemplateid = 10002

addInvoiceUrlToOrders(client, documentid)
.then(() => sendInvoices(client, mailtemplateid))
.catch(console.log)
*/
