const initialize = require('../src/initialization/index.js')
const connectDatabase = require('../src/util/connectDatabase.js')
const ScheduleManager = require('../src/structs/ScheduleManager.js')
const setConfig = require('../src/config.js').set

/**
 * Returns the schedules that are only supposed to run, instead of running all of them.
 * It uses process.env.SCHEDULES, where it contains comma-separated schedule names
 *
 * @param {import('../src/structs/db/Schedule')[]} schedules All the available schedules
 * @param {string[]} whitelistNames
 * @returns {string[]|null}
 */
function getWhitelistedSchedules (schedules, whitelistNames = null) {
  if (!whitelistNames) {
    return null
  }
  const arrayVal = whitelistNames
    .split(',')
    .map(name => schedules.find((schedule) => schedule.name === name))
    .filter((schedule) => schedule)
  if (arrayVal.length === 0) {
    return null
  }
  return arrayVal
}

async function testScheduleRun (userConfig, runSettings = {}) {
  let config = setConfig(userConfig)
  config = setConfig({
    ...config
  })
  const {
    schedules: customSchedules,
    testRuns,
    whitelistNames
  } = runSettings
  const con = await connectDatabase(config.database.uri, config.database.connection)
  console.log('Connected to database')
  await initialize.setupModels(con)
  const schedules = await initialize.populateSchedules(customSchedules)
  const scheduleManager = new ScheduleManager()
  scheduleManager.testRuns = testRuns
  const whitelistedSchedules = getWhitelistedSchedules(schedules, whitelistNames)
  /**
   * If a whitelist exists in process.env, only run those specific schedules.
   */
  if (!whitelistedSchedules) {
    scheduleManager.addSchedules(schedules)
  } else {
    scheduleManager.addSchedules(whitelistedSchedules)
  }
  scheduleManager.beginTimers()
  return scheduleManager
}

module.exports = testScheduleRun

/**
 * 0. Only run certain schedules in ScheduleRun
 * 1. Measure how much traffic supporter schedules make
 * 2. create discriminators for failed links, and update failed links based on that
 * 3. Add support for proxies
 * 4. only use proxy after request failure
 *
 * what about failure messages?  `1
 *
 */
