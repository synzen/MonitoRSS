const initialize = require('../src/initialization/index.js')
const connectDatabase = require('../src/util/connectDatabase.js')
const ScheduleManager = require('../src/structs/ScheduleManager.js')
const setConfig = require('../src/config.js').set

async function testScheduleRun (userConfig, runSettings = {}) {
  let config = setConfig(userConfig)
  config = setConfig({
    ...config
  })
  const {
    schedules: customSchedules,
    testRuns
  } = runSettings
  const con = await connectDatabase(config.database.uri, config.database.connection)
  console.log('Connected to database')
  await initialize.setupModels(con)
  const schedules = await initialize.populateSchedules(customSchedules)
  const scheduleManager = new ScheduleManager()
  scheduleManager.testRuns = testRuns
  scheduleManager.addSchedules(schedules)
  scheduleManager.beginTimers()
  return scheduleManager
}

module.exports = testScheduleRun
