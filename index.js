'use strict'

const env = require('node-env-file')
env(__dirname + '/.env')

const   util = require("util"),
        R = require("ramda"),
        Promise = require("bluebird"),
        api = require("tm_api")

api.setDebug(true)

exports.api = api

const   _ = R.__, apply = R.apply, assoc = R.assoc, concat = R.concat, curry = R.curry, groupBy = R.groupBy, has = R.has, head = R.head, is = R.is, juxt = R.juxt, pipe = R.pipe, pluck = R.pluck, values = R.values, objOf = R.objOf, prop = R.prop, tap = R.tap, when = R.when, 
        map = curry(Promise.mapSeries),
        isNotEmpty = R.complement(R.isEmpty),
		maybeProp = curry( (property, value) => {
			if(!is(Object, value)) {
				return null
			}

			if(!has(property, value)) {
				return null
			}

			return prop(property, value)
		}),		
        query = curry((template, value) => util.format(template, value)),
        getTickets = (client, orderid) => pipe(query(`select id from tm.ticket where orderid = %d`), curry(api.query)(client))(orderid),
        removeContact = curry(api.put)(_, "orders", _, {customerid: null})

const removeTickets = curry((client, orderid) => {
    const apiRemoveTickets = tickets => api.del(client, "tickets", orderid, {tickets})
    return getTickets(orderid)
    .then(pluck("id"))
    .then(when(isNotEmpty, apiRemoveTickets))
})

const cleanOrder = curry((client, orderid) => {
    return removeContact(client, orderid)
    .then(() => removeTickets(client, orderid))
    .catch(reason => console.log(reason))
})

exports.cleanOrder = cleanOrder


const log = curry((labela, labelb, a, b) => console.log(`${labela}: '${a}' - ${labelb}: '${JSON.stringify(b)}'`))

const getOrderid = pipe(head, prop('orderid'))
const getTicketPayload = pipe(pluck('ticketid'), objOf('tickets'))
const apiDelTickets = (client, tickets) => api.del(client, 'tickets', tickets)
const cleanTickets = (client, tickets) => pipe(juxt([getOrderid, getTicketPayload]), tap(apply(log("Orderid", "Tickets"))), apply(apiDelTickets(client)))(tickets)

const removeTicketsOfEvents = (client, events) => {
    const sql = `select o.id orderid, t.id ticketid from tm.order o inner join tm.ticket t on t.orderid = o.id inner join tm.tickettype tt on tt.id = t.tickettypeid where eventid in (${events})`
    return api.export(client, sql)
    .then(groupBy(prop('orderid')))
    .then(values)
    .then(map(R.__, cleanTickets(client)))
    .catch(reason => console.log(reason))
}

exports.removeTicketsOfEvents = removeTicketsOfEvents

exports.getDocumentUrl = curry((client, documentid, orderid) => api.get(client, "orderdocuments", [orderid, documentid])
                            .then(R.prop('url'))
                            .then(s => s.substring(1))
                            .then(R.concat("http://")))

const getCustomField = curry((endpoint, client, id, key) => api.query(client, `select c_${key} from tm.${endpoint.slice(0,-1)} where id = ${id}`).then(head).then(prop(concat("c_", key))))

exports.getContactField = getCustomField("contacts")
exports.getEventField = getCustomField("events")
exports.getOrderField = getCustomField("orders")

const updateCustomField = curry((endpoint, client, id, key, val) => api.put(client, endpoint, id, {"customfields": {[concat("c_", key)]: val}}))

exports.updateContactField = updateCustomField("contacts")
exports.updateEventField = updateCustomField("events")
exports.updateOrderField = updateCustomField("orders")

exports.sendDelivery = curry((client, templateid, orderid) => api.post(client, "emaildelivery", orderid, {templateid}))

 