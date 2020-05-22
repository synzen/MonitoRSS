const initialize = require('../src/util/initialization.js')
const connectDatabase = require('../src/util/connectDatabase.js')
const ScheduleRun = require('../src/structs/ScheduleRun.js')
const setConfig = require('../src/config.js').set

async function testScheduleRun (userConfig) {
  let config = setConfig(userConfig)
  config = setConfig({
    ...config,
    log: {
      ...config.log,
      level: 'debug'
    }
  })
  const con = await connectDatabase(config.database.uri, config.database.connection)
  try {
    console.log('Connected to database')
    await initialize.setupModels(con)
    await initialize.populateSchedules()
    console.log('Models set up')
    const schedule = {
      name: 'default',
      refreshRateMinutes: 999
    }
    console.log('Running...')
    const scheduleRun = new ScheduleRun(schedule, 0, true)
    scheduleRun.on('finish', () => {
      con.close()
    })
    await scheduleRun.run(new Set())
    return scheduleRun
  } finally {
    con.close()
  }
}

module.exports = testScheduleRun
