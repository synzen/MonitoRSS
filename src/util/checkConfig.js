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
    locale: { type: String, default: 'en-US' },
    enableCommands: { type: Boolean, default: true },
    prefix: { type: String, default: undefined },
    status: { type: String, default: 'online' },
    activityType: { type: String, default: '' },
    activityName: { type: String, default: '' },
    streamActivityURL: { type: String, default: '' },
    ownerIDs: { type: Array, default: [] },
    menuColor: { type: Number, default: 7833753 },
    deleteMenus: { type: Boolean, default: true },
    exitOnSocketIssues: { type: Boolean, default: true },
    deleteInvalidGuildLocales: { type: Boolean, default: false }
  },
  database: {
    uri: { type: String, default: 'mongodb://localhost/rss' },
    redis: { type: String, default: '' },
    clean: { type: Boolean, default: false },
    articlesExpire: { type: Number, default: 14 }
  },
  feeds: {
    refreshRateMinutes: { type: Number, default: 10 },
    checkTitles: { type: Boolean, default: false },
    timezone: { type: String, default: 'America/New_York' },
    dateFormat: { type: String, default: 'ddd, D MMMM YYYY, h:mm A z' },
    dateLanguage: { type: String, default: moment.locales()[0] },
    dateLanguageList: { type: Array, default: ['en'] },
    dateFallback: { type: Boolean, default: false },
    timeFallback: { type: Boolean, default: false },
    hoursUntilFail: { type: Number, default: 0 },
    notifyFail: { type: Boolean, default: true },
    sendOldOnFirstCycle: { type: Boolean, default: true },
    cycleMaxAge: { type: Number, default: 1 },
    max: { type: Number, default: 0 },
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
    parallelBatches: { type: Number, default: 1 },
    parallelShards: { type: Number, default: 1 }
  },
  web: {
    enabled: { type: Boolean, default: false },
    trustProxy: { type: Boolean, default: false },
    sessionSecret: { type: String, default: 'keyboard cat' },
    port: { type: Number, default: 8080 },
    redirectUri: { type: String, default: '' },
    clientId: { type: String, default: '' },
    clientSecret: { type: String, default: '' },
    https: {
      enabled: { type: Boolean, default: false },
      privateKey: { type: String, default: '' },
      certificate: { type: String, default: '' },
      chain: { type: String, default: '' },
      port: { type: Number, default: 443 }
    }
  }
}

exports.check = userConfig => {
  let fatalInvalidConfigs = {}
  let invalidConfigs = {}
  // console.log(userConfig)
  function checkIfRequired (configSpecification, locationString, errMsg) {
    if (configSpecification.default === undefined) {
      fatalInvalidConfigs[locationString] = errMsg
      return
    }
    const locations = locationString.split('.')
    let reference = userConfig
    const len = locations.length
    for (let i = 0; i < len; ++i) {
      const location = locations[i]
      // This is the only way to modify by reference in this case
      if (i === len - 1) {
        reference[location] = configSpecification.default
      } else {
        reference = reference[location]
      }
    }
    invalidConfigs[locationString] = `${errMsg}. Defaulting to ${Array.isArray(configSpecification.default) ? `[${configSpecification.default}]` : configSpecification.default === '' ? 'an empty string' : configSpecification.default}`
  }

  function traverse (referenceObject, userObject, location) {
    for (const key in referenceObject) {
      const currentLocation = !location ? key : `${location}.${key}`
      if (!referenceObject[key].type) {
        traverse(referenceObject[key], userObject[key], currentLocation)
        continue
      }
      const configSpecification = referenceObject[key]
      const userVal = userObject[key]
      if (userVal === undefined || userVal.constructor !== configSpecification.type) {
        checkIfRequired(configSpecification, currentLocation, `Expected ${configSpecification.type.name}, found ${userVal === undefined ? userVal : userVal.constructor.name}`)
      } else {
        if ((userVal).constructor === Number && userVal < 0) {
          checkIfRequired(configSpecification, currentLocation, `Cannot be less than 0`)
        } else if (key === 'timezone' && !moment.tz.zone(userVal)) {
          checkIfRequired(configSpecification, currentLocation, 'Invalid timezone')
        } else if (key === 'menuColor' && userVal > 16777215) {
          checkIfRequired(configSpecification, currentLocation, `Cannot be larger than 16777215`)
        } else if (key === 'processorMethod' && userVal !== 'concurrent' && userVal !== 'parallel-isolated') {
          checkIfRequired(configSpecification, currentLocation, 'Must be either "concurrent", or "parallel-isolated"')
        } else if (key === 'activityType' && !ACTIVITY_TYPES.includes(userVal)) {
          checkIfRequired(configSpecification, currentLocation, `Must be one of the following: "${ACTIVITY_TYPES.join('","')}"`)
        } else if (key === 'status' && !STATUS_TYPES.includes(userVal)) {
          checkIfRequired(configSpecification, currentLocation, `Must be one of the following: "${STATUS_TYPES.join('","')}"`)
        } else if (key === 'ownerIDs') {
          for (var i = 0; i < userVal.length; ++i) {
            if (userVal[i] === '') continue
            if (!userVal[i] || userVal[i].constructor !== String) {
              checkIfRequired(key, currentLocation, `Detected non-string value (${userVal[i]})`)
              break
            }
          }
        }
      }
    }
  }

  traverse(exports.defaultConfigs, userConfig)

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
