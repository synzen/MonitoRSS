const initialize = require('../src/initialization/index.js')
const connectDatabase = require('../src/util/connectDatabase.js')
const ScheduleManager = require('../src/structs/ScheduleManager.js')
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
  console.log('Connected to database')
  await initialize.setupModels(con)
  const schedules = await initialize.populateSchedules()
  const scheduleManager = new ScheduleManager()
  scheduleManager.testRuns = true
  scheduleManager.addSchedules(schedules)
  scheduleManager.beginTimers()
}

module.exports = testScheduleRun
