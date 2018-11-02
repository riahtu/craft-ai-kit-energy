require('dotenv').config();
const args = require('minimist')(process.argv.slice(2));
const csv = require('../src/parsers/csv')
const debug = require('../node_modules/debug/src');
const EnergyKit = require('../src');
const fs = require('fs');
const luxon = require('luxon');
const path = require('path');
const WeatherProvider = require('../src/providers/weather');
const { endpointPipeline } = require('./endpoint_pipeline');

const log = debug('craft-ai:kit-energy:benchmark:rolling_preds');
log.enabled = true;
const DateTime = luxon.DateTime;
const DATASET_PATH = path.join(__dirname, './data/uci/uci_30T.csv');
const WEATHER_CACHE_PATH = path.join(__dirname, './provider/weather_cache_uci.json');

const [DEPTH, PRED_SIZE, START, INIT, STOP] = [args['depth'],  args['window'], args['start'],  args['init'], args['stop']];
const AGENT_ID = 'uci_res_'+DEPTH.toString();


// function prediction_dates (path_to_dataset, prediction_start, prediction_stop){ 
//     console.log(prediction_start, prediction_stop)
//     log(` : Retrieving prediction dates`)
//     const dates = []
//     return csv
//           .stream(path_to_dataset)
//           .slice(START * PRED_SIZE, STOP * PRED_SIZE)
//           .observe(event => dates.push(event))
//           .then(()=>[DateTime.fromISO(dates[0].date), DateTime.fromISO(dates[dates.length-1].date)])
//   }

//   async function baba () {
//     const [start_date, stop_date] = await prediction_dates(DATASET_PATH);
//     console.log(start_date < stop_date)
// }
// const providers = [ 
//     {
//         provider: WeatherProvider,
//         options:{
//             // token: "j-utilise-le-cache",
//             token: process.env.DARK_SKY_TOKEN,
//             properties: ['temperature'],
//             refresh: 'hourly',
//             cache: {
//                 load: () => require(WEATHER_CACHE_PATH),
//                 size:35040,
//                 save: (cache) => {
//                     fs.writeFileSync(
//                     WEATHER_CACHE_PATH,
//                     JSON.stringify(cache, null, '  ')
//                     );
//                 }
//             }
//         }
//     }
// ]  


const providers = [ 
    {
        provider: WeatherProvider,
        options:{
            // token: "j-utilise-le-cache",
            token: process.env.DARK_SKY_TOKEN,
            properties: ['temperatureLow', 'temperatureHigh'],
            refresh: 'daily',
            cache: {
                load: () => require(WEATHER_CACHE_PATH),
                size:245280,
                save: (cache) => {
                    fs.writeFileSync(
                    WEATHER_CACHE_PATH,
                    JSON.stringify(cache, null, '  ')
                    );
                }
            }
        }
    }
]  

// const metadata = {
//     region: 'IA',
//     latitude: 49.249444,  //Cedar Rapids, Iowa, retrieved from latlong.net
//     longitude: -122.979722   // Latitude and longitude retrieved from https://www.latlong.net
//   }

const metadata = {
region: '91',
latitude: 48.45857,  //Essone 
longitude: 2.156942   // Latitude and longitude retrieved from https://www.latlong.net
}

let kit = EnergyKit
    .initialize({
    token: process.env.CRAFT_AI_TOKEN || process.env.CRAFT_TOKEN,
    providers: providers
    })

async function rolling_pred (agent_id, depth, start_train, start_pred, stop, pred_size){
    const first_pred = start_pred;
    let last_pred = start_pred + pred_size;
    const options = {agent_id, depth, metadata}
    console.log(last_pred, stop)
    while (last_pred <= stop){
            const indexes = [start_train, start_pred, last_pred];
            kit = await endpointPipeline(kit, DATASET_PATH, indexes, options)
            last_pred += pred_size;
            start_pred += pred_size;
            log(`Depth ${depth}, Agent ${agent_id}, ${Math.trunc((last_pred-first_pred)/(stop-first_pred)*100)} % done`);
    }
    log(`Agent ${agent_id} : Stop date reached : no more predictions to compute`)
    return kit
}

rolling_pred(AGENT_ID, DEPTH, START*PRED_SIZE, INIT*PRED_SIZE, STOP*PRED_SIZE, PRED_SIZE)
.then((kit)=>kit.close())
.catch(error => {
    log('Error: rolling predictions interrupted. See error message above.');
    return process.exit(1)

});



