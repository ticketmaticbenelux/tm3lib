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

const mapIndexed = R.addIndex(R.map)

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

    console.log()
    console.log(`*`)
    console.log(`* HANDLE ACTIONS OF EVENT ${eventid} *`)
    console.log(`*`)
    console.log()

    console.log(`[EVENT ${eventid}] Actions: ${util.inspect(actions, {showHidden: false, depth: null})}`)

    const contingentsToChange = R.pipe(R.pluck('tickettypeid'), R.uniq)(actions)
    console.log(`[EVENT ${eventid}] Tickettypes to change: ${contingentsToChange}`)

        const handleUnseatedContingent = contingent => {
            console.log(`[EVENT ${eventid}] > Handle unseated contingent ${contingent.id}`)
            const tickettypeid = R.prop('id')(contingent)
            if(!R.contains(tickettypeid, contingentsToChange)) {
                console.log(`[EVENT ${eventid}] >>> Nothing to do`)
                console.log(contingent)
                return contingent
            }
            const prices = R.path(['eventspecificprices', 'prices'])(contingent)

                const handlePrice = price => {
                    console.log(`[EVENT ${eventid}] >>> Handle pricetypeid ${price.pricetypeid} for unseated tickettypeid ${tickettypeid}`)
                    const pricetypeid = R.prop('pricetypeid')(price)
                    const pricetypesToChange = R.pipe(R.filter(R.propEq('tickettypeid', tickettypeid)), R.pluck('pricetypeid'), R.uniq)(actions)
                    console.log(`[EVENT ${eventid}] >>> Pricetype id's to change: ${pricetypesToChange} for unseated tickettypeid ${tickettypeid}`)
                    if(!R.contains(pricetypeid, pricetypesToChange)) return price
                    return R.assoc('saleschannels', [])(price)
                }

            const newPrices = R.map(handlePrice)(prices)
            return R.pipe(
                R.omit(['eventid', 'name', 'amount', 'pricelistid', 'withimportedbarcodes', 'locks']), 
                R.assocPath(['eventspecificprices', 'prices'], newPrices)
            )(contingent)
        }

        const handleSeatedPrice = R.curry( (seatrankids, seatedprice) => {
            console.log(`[EVENT ${eventid}] > Handle seated price ${seatedprice.pricetypeid}`)
            const pricetypeid = seatedprice.pricetypeid
            const pricetypesToChange = R.pipe(R.pluck('pricetypeid'), R.uniq)(actions)
            if(!R.contains(pricetypeid, pricetypesToChange)) return seatedprice
            
            const seatrankIdsToChange = R.pipe(
                R.filter(R.propEq('eventid', eventid)),
                R.filter(R.propEq('pricetypeid', pricetypeid)), 
                R.pluck('seatrankid'),
                R.uniq
            )(actions)
            console.log(`[EVENT ${eventid}] >>> Seatrank id's to change: ${seatrankIdsToChange} for pricetypeid ${pricetypeid}`)

            const getIndex = val => R.findIndex(R.equals(val))(seatrankids)
            const indexesToChange = R.map(getIndex)(seatrankIdsToChange)

            console.log(`[EVENT ${eventid}] >>> Indexes to change: ${indexesToChange} for pricetypeid ${pricetypeid} with list of seatranks [${seatrankids}]`)

            const handleAvailability = (val, index) => {
                if(R.contains(index, indexesToChange)) return false // Not available
                return val
            }

            const newAvailabilities = mapIndexed(handleAvailability)(seatedprice.availabilities)

            const newSeatedprice = R.assoc('availabilities', newAvailabilities, seatedprice)
            
            console.log(`New seatedprice: ${util.inspect(newSeatedprice,{showHidden: false, depth: null})}`)

            return newSeatedprice
        })

    // unseated contingents
    const contingents = R.map(handleUnseatedContingent)(event.contingents)

    // seatingplan event specific prices
    const prices = (event.seatingplaneventspecificprices) ? R.map(handleSeatedPrice(event.seatingplaneventspecificprices.seatrankids))(event.seatingplaneventspecificprices.prices) : null
    const seatingplaneventspecificprices = prices ? {seatrankids:event.seatingplaneventspecificprices.seatrankids, prices} : null
    const payload = seatingplaneventspecificprices ? {contingents, seatingplaneventspecificprices} : {contingents}

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

