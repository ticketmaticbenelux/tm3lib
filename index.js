'use strict'

const env = require('node-env-file')
env(__dirname + '/.env')

const   util = require("util"),
        R = require("ramda"),
        Promise = require("bluebird"),
        api = require("tm_api")
        
const client = {
	shortname: process.env.SHORTNAME,
	key: process.env.API_KEY,
	secret: process.env.API_SECRET
}

api.setDebug(true)

const   _ = R.__, apply = R.apply, assoc = R.assoc, curry = R.curry, juxt = R.juxt, pluck = R.pluck, when = R.when, pipe = R.pipe, head = R.head, groupBy = R.groupBy, values = R.values, objOf = R.objOf, prop = R.prop, tap = R.tap,
        map = curry(Promise.mapSeries),
        isNotEmpty = R.complement(R.isEmpty),
        query = curry((template, value) => util.format(template, value)),
        getTickets = pipe(query(`select id from tm.ticket where orderid = %d`), curry(api.query)(client)),
        removeContact = curry(api.put)(client, "orders", _, {customerid: null})

const removeTickets = orderid => {
    const apiRemoveTickets = tickets => api.del(client, "tickets", orderid, {tickets})
    return getTickets(orderid)
    .then(pluck("id"))
    .then(when(isNotEmpty, apiRemoveTickets))
}

const cleanOrder = orderid => {
    return removeContact(orderid)
    .then(() => removeTickets(orderid))
    .catch(reason => console.log(reason))
}

const log = curry((labela, labelb, a, b) => console.log(`${labela}: '${a}' - ${labelb}: '${JSON.stringify(b)}'`))

const getOrderid = pipe(head, prop('orderid'))
const getTicketPayload = pipe(pluck('ticketid'), objOf('tickets'))
const apiDelTickets = curry(api.del)(client, 'tickets')
const cleanTickets = pipe(juxt([getOrderid, getTicketPayload]), tap(apply(log("Orderid", "Tickets"))), apply(apiDelTickets)) 

const removeTicketsOfEvents = events => {
    const sql = `select o.id orderid, t.id ticketid from tm.order o inner join tm.ticket t on t.orderid = o.id inner join tm.tickettype tt on tt.id = t.tickettypeid where eventid in (${events})`
    return api.export(client, sql)
    .then(groupBy(prop('orderid')))
    .then(values)
    .then(map(R.__, cleanTickets))
    .catch(reason => console.log(reason))
}

exports.cleanOrder = cleanOrder
exports.removeTicketsOfEvents = removeTicketsOfEvents