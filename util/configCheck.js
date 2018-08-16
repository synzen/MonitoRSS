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
    if (missingChannelCount[rssName] >= 3 && storage.initialized) {
      dbOps.guildRss.removeFeed(guildRss, rssName, true)
        .then(() => {
          log.general.info(`Removed feed ${source.link} from guild ${guildId} due to excessive missing channels warnings`)
          delete missingChannelCount[rssName]
        })
        .catch(err => log.general.warning(`Unable to remove feed ${source.link} from guild ${guildId} due to excessive missing channels warning`, err))
    }
    return false
  } else {
    if (missingChannelCount[rssName]) delete missingChannelCount[rssName]
    return true
  }
}

exports.defaultConfigs = {
  log: {
    dates: {type: Boolean, default: false},
    linkErrs: {type: Boolean, default: true},
    unfiltered: {type: Boolean, default: true},
    failedFeeds: {type: Boolean, default: true}
  },
  bot: {
    token: {type: String, default: undefined},
    enableCommands: {type: Boolean, default: true},
    prefix: {type: String, default: undefined},
    status: {type: String, default: 'online'},
    activityType: {type: String, default: ''},
    activityName: {type: String, default: ''},
    controllerIds: {type: Array, default: []},
    menuColor: {type: Number, default: 7833753},
    deleteMenus: {type: Boolean, default: false}
  },
  database: {
    uri: {type: String, default: 'mongodb://localhost/rss'},
    clean: {type: Boolean, default: false},
    articlesExpire: {type: Number, default: 14},
    guildBackupsExpire: {type: Number, default: 7}
  },
  feeds: {
    refreshTimeMinutes: {type: Number, default: 10},
    checkTitles: {type: Boolean, default: false},
    timezone: {type: String, default: 'America/New_York'},
    dateFormat: {type: String, default: 'ddd, D MMMM YYYY, h:mm A z'},
    dateLanguage: {type: String, default: moment.locales()[0]},
    dateLanguageList: {type: Array, default: ['en']},
    dateFallback: {type: Boolean, default: false},
    timeFallback: {type: Boolean, default: false},
    failLimit: {type: Number, default: 0},
    notifyFail: {type: Boolean, default: true},
    sendOldMessages: {type: Boolean, default: false},
    defaultMaxAge: {type: Number, default: 1},
    cycleMaxAge: {type: Number, default: 1},
    defaultMessage: {type: String, default: ':newspaper:  |  **{title}**\n\n{link}\n\n{subscriptions}'},
    showRegexErrs: {type: Boolean, default: true},
    imgPreviews: {type: Boolean, default: true},
    imgLinksExistence: {type: Boolean, default: true},
    checkDates: {type: Boolean, default: true},
    formatTables: {type: Boolean, default: false},
    toggleRoleMentions: {type: Boolean, default: false}
  },
  advanced: {
    shards: {type: Number, default: 1},
    batchSize: {type: Number, default: 400},
    processorMethod: {type: String, default: 'concurrent'},
    parallel: {type: Number, default: 2}
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

      if (userVal === undefined || userVal.constructor !== configVal.type) {
        checkIfRequired(configCategory, configName, `Expected ${configVal.type.name}, found ${userVal === undefined ? userVal : userVal.constructor.name}`)
      } else {
        if ((userVal).constructor === Number && userVal < 0) checkIfRequired(configCategory, configName, `Cannot be less than 0`)
        else if (configName === 'timezone' && !moment.tz.zone(userVal)) checkIfRequired(configCategory, configName, 'Invalid timezone')
        else if (configName === 'menuColor' && userVal > 16777215) checkIfRequired(configCategory, configName, `Cannot be larger than 16777215`)
        else if (configName === 'sqlType' && (userVal !== 'sqlite3' && userVal !== 'mysql')) checkIfRequired(configCategory, configName, 'Must be either "mysql" or "sqlite3"')
        else if (configName === 'processorMethod' && userVal !== 'concurrent' && userVal !== 'concurrent-isolated' && userVal !== 'parallel-isolated') checkIfRequired(configCategory, configName, 'Must be either "concurrent", "concurrent-isolated", or "parallel-isolated"')
        else if (configName === 'activityType' && !ACTIVITY_TYPES.includes(userVal.toUpperCase())) checkIfRequired(configCategory, configName, `Must be one of the following: "${ACTIVITY_TYPES.join('","')}"`)
        else if (configName === 'status' && !STATUS_TYPES.includes(userVal.toLowerCase())) checkIfRequired(configCategory, configName, `Must be one of the following: "${STATUS_TYPES.join('","')}"`)
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

  const defLang = userConfig.feeds.dateLanguage
  const langList = userConfig.feeds.dateLanguageList
  if (!langList.includes(defLang)) langList.unshift(defLang)
  for (var u = langList.length - 1; u >= 0; --u) moment.locale(langList[u]) // Set the global moment locale/language to the 0 index item

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
