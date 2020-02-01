// Check for invalid configs on startup and at the beginning of each feed retrieval cycle
const moment = require('moment-timezone')
const iconv = require('iconv-lite')
const ACTIVITY_TYPES = ['', 'PLAYING', 'STREAMING', 'LISTENING', 'WATCHING']
const STATUS_TYPES = ['online', 'idle', 'dnd', 'invisible']

exports.defaultConfigs = {
  log: {
    dates: { type: Boolean, default: true },
    linkErrs: { type: Boolean, default: true },
    unfiltered: { type: Boolean, default: true },
    failedFeeds: { type: Boolean, default: true }
  },
  bot: {
    token: { type: String, default: undefined },
    enableCommands: { type: Boolean, default: true },
    prefix: { type: String, default: undefined },
    status: { type: String, default: 'online' },
    activityType: { type: String, default: '' },
    activityName: { type: String, default: '' },
    controllerIds: { type: Array, default: [] },
    menuColor: { type: Number, default: 7833753 },
    deleteMenus: { type: Boolean, default: true },
    exitOnSocketIssues: { type: Boolean, default: true }
  },
  database: {
    uri: { type: String, default: 'mongodb://localhost/rss' },
    clean: { type: Boolean, default: false },
    articlesExpire: { type: Number, default: 14 },
    guildBackupsExpire: { type: Number, default: 7 }
  },
  feeds: {
    refreshTimeMinutes: { type: Number, default: 10 },
    checkTitles: { type: Boolean, default: false },
    timezone: { type: String, default: 'America/New_York' },
    dateFormat: { type: String, default: 'ddd, D MMMM YYYY, h:mm A z' },
    dateLanguage: { type: String, default: moment.locales()[0] },
    dateLanguageList: { type: Array, default: ['en'] },
    dateFallback: { type: Boolean, default: false },
    timeFallback: { type: Boolean, default: false },
    failLimit: { type: Number, default: 0 },
    notifyFail: { type: Boolean, default: true },
    sendOldOnFirstCycle: { type: Boolean, default: true },
    cycleMaxAge: { type: Number, default: 1 },
    defaultMessage: { type: String, default: ':newspaper:  |  **{title}**\n\n{link}\n\n{subscriptions}' },
    imgPreviews: { type: Boolean, default: true },
    imgLinksExistence: { type: Boolean, default: true },
    checkDates: { type: Boolean, default: true },
    formatTables: { type: Boolean, default: false },
    toggleRoleMentions: { type: Boolean, default: false }
  },
  advanced: {
    shards: { type: Number, default: 1 },
    batchSize: { type: Number, default: 400 },
    forkBatches: { type: Boolean, default: false },
    parallelBatches: { type: Number, default: 2 },
    parallelShards: { type: Number, default: 1 }
  }
}

exports.check = userConfig => {
  let fatalInvalidConfigs = {}
  let invalidConfigs = {}

  function checkIfRequired (configCategory, configName, errMsg) {
    let config = exports.defaultConfigs[configCategory][configName]
    if (config.default === undefined) {
      fatalInvalidConfigs[configCategory + '.' + configName] = errMsg
    } else {
      userConfig[configCategory][configName] = config.default
      invalidConfigs[configCategory + '.' + configName] = `${errMsg}. Defaulting to ${Array.isArray(config.default) ? `[${config.default}]` : config.default === '' ? 'an empty string' : config.default}`
    }
  }

  for (const configCategory in exports.defaultConfigs) {
    for (const configName in exports.defaultConfigs[configCategory]) {
      const configVal = exports.defaultConfigs[configCategory][configName]
      const userVal = userConfig[configCategory][configName]

      if (userVal === undefined || userVal.constructor !== configVal.type) {
        checkIfRequired(configCategory, configName, `Expected ${configVal.type.name}, found ${userVal === undefined ? userVal : userVal.constructor.name}`)
      } else {
        if ((userVal).constructor === Number && userVal < 0 && configName !== 'articlesExpire') checkIfRequired(configCategory, configName, `Cannot be less than 0`)
        else if (configName === 'timezone' && !moment.tz.zone(userVal)) checkIfRequired(configCategory, configName, 'Invalid timezone')
        else if (configName === 'menuColor' && userVal > 16777215) checkIfRequired(configCategory, configName, `Cannot be larger than 16777215`)
        else if (configName === 'processorMethod' && userVal !== 'concurrent' && userVal !== 'parallel-isolated') checkIfRequired(configCategory, configName, 'Must be either "concurrent", or "parallel-isolated"')
        else if (configName === 'activityType' && !ACTIVITY_TYPES.includes(userVal)) checkIfRequired(configCategory, configName, `Must be one of the following: "${ACTIVITY_TYPES.join('","')}"`)
        else if (configName === 'status' && !STATUS_TYPES.includes(userVal)) checkIfRequired(configCategory, configName, `Must be one of the following: "${STATUS_TYPES.join('","')}"`)
        else if (configName === 'controllerIds') {
          for (var i = 0; i < userVal.length; ++i) {
            if (userVal[i] === '') continue
            if (!userVal[i] || userVal[i].constructor !== String) {
              checkIfRequired(configCategory, configName, `Detected non-string value (${userVal[i]})`)
              break
            }
          }
        }
      }
    }
  }

  // Miscellaneous checks (such as configs using objects)
  const decodeSettings = userConfig.feeds.decode
  if (typeof decodeSettings === 'object' && decodeSettings !== null) {
    for (const url in decodeSettings) {
      if (typeof decodeSettings[url] !== 'string') invalidConfigs['feeds.decode.' + url] = `Expected string, found ${typeof decodeSettings[url]}`
      else if (!iconv.encodingExists(decodeSettings[url])) fatalInvalidConfigs['feeds.decode.' + url] = `Specified encoding "${decodeSettings[url]}" does not exist for iconv-lite`
    }
  }

  const defLang = userConfig.feeds.dateLanguage
  const langList = userConfig.feeds.dateLanguageList
  if (!langList.includes(defLang)) langList.unshift(defLang)
  for (let u = langList.length - 1; u >= 0; --u) moment.locale(langList[u]) // Set the global moment locale/language to the 0 index item

  let errMsg = ''
  for (const e in fatalInvalidConfigs) errMsg += `\n${e}: ${fatalInvalidConfigs[e]}`
  if (errMsg) {
    return {
      fatal: true,
      message: `Fatal invalid configuration(s) found, must be fixed:\n${errMsg}\n`
    }
  }

  errMsg = ''
  for (const cName in invalidConfigs) errMsg += `\n${cName}: ${invalidConfigs[cName]}`
  if (errMsg) {
    return {
      fatal: false,
      message: `Invalid configuration(s) found, forced defaults have been set:\n${errMsg}\n`
    }
  }
}
