// Check for invalid configs on startup and at the beginning of each feed retrieval cycle
const moment = require('moment-timezone')
const log = require('./logger.js')
const dbOps = require('./dbOps.js')
const storage = require('./storage.js')
const missingChannelCount = {}
const ACTIVITY_TYPES = ['', 'PLAYING', 'STREAMING', 'LISTENING', 'WATCHING']
const STATUS_TYPES = ['online', 'idle', 'dnd', 'invisible']

exports.checkExists = (rssName, guildRss, logging, initializing) => {
  const source = guildRss.sources[rssName]
  if (source.disabled === true) {
    if (logging) log.cycle.warning(`${rssName} in guild ${guildRss.id} is disabled in channel ${source.channel}, skipping...`)
    return false
  }
  if (!source.link || !source.link.startsWith('http')) {
    if (logging) log.cycle.warning(`${rssName} in guild ${guildRss.id} has no valid link defined, skipping...`)
    return false
  }
  if (!source.channel) {
    if (logging) log.cycle.warning(`${rssName} in guild ${guildRss.id} has no channel defined, skipping...`)
    return false
  }
  return true
}

exports.validChannel = (bot, guildRss, rssName) => {
  const guildId = guildRss.id
  const source = guildRss.sources[rssName]
  const channel = bot.channels.get(source.channel)
  const guild = bot.guilds.get(guildId)

  if (!channel) {
    log.cycle.warning(`Channel ${source.channel} in guild ${guildId} for feed ${source.link} was not found, skipping source`, guild)
    missingChannelCount[rssName] = missingChannelCount[rssName] ? missingChannelCount[rssName] + 1 : 1
    if (missingChannelCount[rssName] >= 10 && storage.initialized) {
      dbOps.guildRss.removeFeed(guildRss, rssName, err => {
        if (err) return log.general.warning(`Unable to remove feed ${source.link} from guild ${guildId} due to excessive missing channels warning`, err)
        log.general.info(`Removing feed ${source.link} from guild ${guildId} due to excessive missing channels warnings`)
        delete missingChannelCount[rssName]
      }, true)
    }
    return false
  } else {
    if (missingChannelCount[rssName]) delete missingChannelCount[rssName]
    return true
  }
}

exports.defaultConfigs = {
  log: {
    dates: {type: 'boolean', default: false},
    linkErrs: {type: 'boolean', default: true},
    unfiltered: {type: 'boolean', default: true},
    failedFeeds: {type: 'boolean', default: true}
  },
  bot: {
    token: {type: 'string', default: undefined},
    enableCommands: {type: 'boolean', default: true},
    prefix: {type: 'string', default: undefined},
    status: {type: 'string', default: 'online'},
    activityType: {type: 'string', default: ''},
    activityName: {type: 'string', default: ''},
    controllerIds: {type: 'object', default: []},
    menuColor: {type: 'number', default: 7833753},
    deleteMenus: {type: 'boolean', default: false}
  },
  database: {
    uri: {type: 'string', default: 'mongodb://localhost/rss'},
    clean: {type: 'boolean', default: false},
    articlesExpire: {type: 'number', default: 14},
    guildBackupsExpire: {type: 'number', default: 7}
  },
  feeds: {
    refreshTimeMinutes: {type: 'number', default: 10},
    checkTitles: {type: 'boolean', default: false},
    timezone: {type: 'string', default: 'America/New_York'},
    dateFormat: {type: 'string', default: 'ddd, D MMMM YYYY, h:mm A z'},
    dateLanguage: {type: 'string', default: moment.locales()[0]},
    dateLanguageList: {type: 'object', default: ['en']},
    dateFallback: {type: 'boolean', default: false},
    timeFallback: {type: 'boolean', default: false},
    failLimit: {type: 'number', default: 0},
    notifyFail: {type: 'boolean', default: true},
    sendOldMessages: {type: 'boolean', default: false},
    defaultMaxAge: {type: 'number', default: 1},
    cycleMaxAge: {type: 'number', default: 1},
    defaultMessage: {type: 'string', default: ':newspaper:  |  **{title}**\n\n{link}\n\n{subscriptions}'},
    showRegexErrs: {type: 'boolean', default: true},
    imgPreviews: {type: 'boolean', default: true},
    imgLinksExistence: {type: 'boolean', default: true},
    checkDates: {type: 'boolean', default: true}
  },
  advanced: {
    shards: {type: 'number', default: 1},
    batchSize: {type: 'number', default: '400'},
    processorMethod: {type: 'string', default: 'single'}
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

  for (var configCategory in exports.defaultConfigs) {
    for (var configName in exports.defaultConfigs[configCategory]) {
      const configVal = exports.defaultConfigs[configCategory][configName]
      const userVal = userConfig[configCategory][configName]

      if (configVal.type !== typeof userVal) {
        checkIfRequired(configCategory, configName, `Expected ${configVal.type}, found ${typeof userVal}`)
      } else {
        if (typeof userVal === 'number' && userVal < 0) checkIfRequired(configCategory, configName, `Cannot be less than 0`)
        else if (configName === 'timezone' && !moment.tz.zone(userVal)) checkIfRequired(configCategory, configName, 'Invalid timezone')
        else if (configName === 'menuColor' && userVal > 16777215) checkIfRequired(configCategory, configName, `Cannot be larger than 16777215`)
        else if (configName === 'sqlType' && (userVal !== 'sqlite3' && userVal !== 'mysql')) checkIfRequired(configCategory, configName, 'Must be either "mysql" or "sqlite3"')
        else if (configName === 'processorMethod' && userVal !== 'single' && userVal !== 'isolated' && userVal !== 'parallel') checkIfRequired(configCategory, configName, 'Must be either "single", "isolated", or "parallel"')
        else if (configName === 'activityType' && !ACTIVITY_TYPES.includes(userVal.toUpperCase())) checkIfRequired(configCategory, configName, `Must be one of the following: "${ACTIVITY_TYPES.join('","')}"`)
        else if (configName === 'status' && !STATUS_TYPES.includes(userVal.toLowerCase())) checkIfRequired(configCategory, configName, `Must be one of the following: "${STATUS_TYPES.join('","')}"`)
        else if (configName === 'controllerIds') {
          for (var i in userVal) {
            if (typeof userVal[i] !== 'string') {
              checkIfRequired(configCategory, configName, `Detected non-string value (${userVal[i]})`)
              break
            }
          }
        }
      }
    }
  }

  const defLang = userConfig.feeds.dateLanguage
  const langList = userConfig.feeds.dateLanguageList
  if (!langList.includes(defLang)) langList.unshift(defLang)
  for (var u = langList.length - 1; u >= 0; --u) moment.locale(langList[u])  // Set the global moment locale/language to the 0 index item

  let errMsg
  for (var e in fatalInvalidConfigs) errMsg += `\n${e}: ${fatalInvalidConfigs[e]}`
  if (errMsg) {
    return {
      fatal: true,
      message: `Fatal invalid configuration(s) found, must be fixed:\n${errMsg}\n`
    }
  }

  errMsg = ''
  for (var cName in invalidConfigs) errMsg += `\n${cName}: ${invalidConfigs[cName]}`
  if (errMsg) {
    return {
      fatal: false,
      message: `Invalid configuration(s) found, forced defaults have been set:\n${errMsg}\n`
    }
  }
}
