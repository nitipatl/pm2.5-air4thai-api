const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const Client = require('node-rest-client').Client
const client = new Client()
const NodeCache = require('node-cache')
const cache = new NodeCache({ stdTTL: 60*60*1 })
const keyData = 'pm25-data'
const pm25API = 'http://air4thai.pcd.go.th/forappV2/getAQI_JSON.php'
const geolib = require('geolib')
const icons = [
  'http://air4thai.pcd.go.th/webV2/image/ball_0.png',
  'http://air4thai.pcd.go.th/webV2/image/ball_1.png',
  'http://air4thai.pcd.go.th/webV2/image/ball_2.png',
  'http://air4thai.pcd.go.th/webV2/image/ball_3.png',
  'http://air4thai.pcd.go.th/webV2/image/ball_4.png'
]

express()
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/api', async (req, res) => {
    data = await (new Promise(resolve => {
      const cacheData = cache.get(keyData)
      if (!cacheData) {
        client.get(pm25API, async (data, response) => {
          console.log('cached! ', cache.set(keyData, data))
          resolve(data)
        })
      } else {
        resolve(cacheData)
      }
    }))

    let cordMaps = []
    data['stations'].forEach(row => {
      cordMaps[row.stationID] = {
        latitude: row.lat,
        longitude: row.long,
      }
    })
    
    let keysNearest = data['stations'].map(row => row.stationID)

    if (req.query.lat && req.query.long) {
      keysNearest = geolib.findNearest({latitude: req.query.lat, longitude: req.query.long}, cordMaps, 1, 5).map(row => row.key);
    }
    const resp = data['stations'].filter(row => keysNearest.includes(row.stationID)).map(row => ({
      nameTH: row.nameTH,
      nameEN: row.nameEN,
      areaTH: row.areaTH,
      areaEN: row.areaEN,
      latitude: row.lat,
      longitude: row.long,
      updated: row.AQILast.date + ' ' + row.AQILast.time,
      aqi: {
        ...row.AQILast.AQI,
        icon: icons[row.AQILast.AQI.color_id]
      }
    }))

    return res.status(200)
      .type('application/json')
      .send(resp)
  })
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))
