'use strict'

const env = require('node-env-file')
env(__dirname + '/.env')

const 
    R = require("ramda"),
    Promise = require("bluebird"),
    util = require("util"),
    lib = require("./index.js")
        
const client = {
	shortname: process.env.SHORTNAME,
	key: process.env.API_KEY,
	secret: process.env.API_SECRET
}

let CACHE = {}

const addToCache = R.curry((label, data) => { CACHE = R.assoc(label, data, CACHE); return Promise.resolve(data); } )

const getEventIds = R.pipe(R.pluck('eventid'), R.uniq)
const fetchEvent = R.curry(lib.api.get)(client, 'events')
const fetchEvents = R.curryN(2, Promise.map)(R.__, fetchEvent)
const getEvent = eventid => {
    const isRightEvent = R.propEq('id', eventid)
    return R.pipe(R.filter(isRightEvent), R.head)(CACHE.events)
}

const handleActionsEvent = actions => {
    const eventid = R.pipe(R.head, R.prop('eventid'))(actions)
    const event = getEvent(eventid)

    console.log(`* HANDLE ACTIONS OF EVENT ${eventid} *`)

    const contingentsToChange = R.pipe(R.pluck('tickettypeid'), R.uniq)(actions)
    console.log(`[EVENT ${eventid}] Contingent id's to change: ${contingentsToChange}`)

    const handleContingent = contingent => {
        console.log(`[EVENT ${eventid}] > Handle contingent ${contingent.id}`)
        const tickettypeid = R.prop('id')(contingent)
        if(!R.contains(tickettypeid, contingentsToChange)) return contingent
        const prices = R.path(['eventspecificprices', 'prices'])(contingent)

        const handlePrice = price => {
            console.log(`[EVENT ${eventid}] >>> Handle pricetypeid ${price.pricetypeid} for tickettypeid ${tickettypeid}`)
            const pricetypeid = R.prop('pricetypeid')(price)
            const pricetypesToChange = R.pipe(R.filter(R.propEq('tickettypeid', tickettypeid)), R.pluck('pricetypeid'), R.uniq)(actions)
            console.log(`[EVENT ${eventid}] >>> Pricetype id's to change: ${pricetypesToChange} for tickettypeid ${tickettypeid}`)
            if(!R.contains(pricetypeid, pricetypesToChange)) return price
            return R.assoc('saleschannels', [])(price)
        }

        const newPrices = R.map(handlePrice)(prices)
        return R.pipe(
            R.omit(['eventid', 'name', 'amount', 'pricelistid', 'withimportedbarcodes', 'locks']), 
            R.assocPath(['eventspecificprices', 'prices'], newPrices)
        )(contingent)
    }

    const newContingents = R.map(handleContingent)(event.contingents)

    const payload = R.objOf('contingents', newContingents)

    console.log(`[EVENT ${eventid}] Payload: ${util.inspect(payload, {showHidden: false, depth: null})}`)

    return lib.api.put(client, 'events', eventid, payload)
    .catch(reason => console.log(`Update event failed, reason: ${util.inspect(reason, {showHidden: false, depth: null})}`))
}
const handleActions = () => Promise.mapSeries(CACHE.actionsGrouped, handleActionsEvent)

let pActions = lib.checkTickettypepricesToClose(client)
.then(addToCache('actions'))

let pActionsGrouped = pActions
.then(R.groupBy(R.prop('eventid')))
.then(R.values)
.then(addToCache('actionsGrouped'))

let pEvents = pActions
.then(getEventIds)
.then(fetchEvents)
.then(addToCache('events'))

/*
pEvents
.then(() => console.log(CACHE))
*/

pEvents
.then(handleActions)

