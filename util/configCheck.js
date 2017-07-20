// Check for invalid configs on startup and at the beginning of each feed retrieval cycle

exports.checkExists = function (rssName, feed, logging, initializing) {
  let valid = true

  if (feed.enabled === false) {
    if (logging) console.log(`RSS Config Info: ${rssName} is disabled in channel ${feed.channel}, skipping...`)
    return false
  }

  if (!feed.link || !feed.link.startsWith('http')) {
    if (logging) console.log(`RSS Config Warning: ${rssName} has no valid link defined, skipping...`)
    valid = false
  } else if (!feed.channel) {
    if (logging) console.log(`RSS Config Warning: ${rssName} has no channel defined, skipping...`)
    valid = false
  }

  return valid
}

exports.validChannel = function (bot, guildId, feed) {
  const channel = bot.channels.has(feed.channel)
  const guild = bot.guilds.get(guildId)

  if (!channel) {
    console.log(`RSS Config Warning: (${guildId}, ${guild.name}) => ${feed.link}'s channel was not found. skipping...`)
    return false
  } else return true
}

exports.checkMasterConfig = function (masterConfig) {
  let configTypes = {
    logging: {
      logDates: {type: 'boolean', default: false},
      discordChannelLog: {type: 'string', default: ''},
      showLinkErrs: {type: 'boolean', default: true},
      showUnfiltered: {type: 'boolean', default: true}
    },
    botSettings: {
      token: {type: 'string', default: undefined},
      enableCommands: {type: 'boolean', default: true},
      prefix: {type: 'string', default: undefined},
      defaultGame: {type: 'string', default: null},
      controllerIds: {type: 'object', default: []},
      menuColor: {type: 'number', default: 7833753},
      deleteMenus: {type: 'boolean', default: false}
    },
    feedManagement: {
      sqlType: {type: 'string', default: 'sqlite3'},
      databaseName: {type: 'string', default: 'rss'},
      enableBackups: {type: 'boolean', default: true},
      enableRestores: {type: 'boolean', default: false},
      cleanDatabase: {type: 'boolean', default: false},
      maxEntryAge: {type: 'number', default: 14}
    },
    feedSettings: {
      refreshTimeMinutes: {type: 'number', default: 10},
      checkTitles: {type: 'boolean', default: false},
      timezone: {type: 'string', default: 'America/New_York'},
      timeFormat: {type: 'string', default: 'ddd, D MMMM YYYY, h:mm A z'},
      maxFeeds: {type: 'number', default: 0},
      failLimit: {type: 'number', default: 0},
      notifyFail: {type: 'boolean', default: true},
      sendOldMessages: {type: 'boolean', default: false},
      defaultMaxAge: {type: 'number', default: 1},
      cycleMaxAge: {type: 'number', default: 1},
      defaultMessage: {type: 'string', default: ':newspaper:  |  **{title}**\n\n{link}\n\n{subscriptions}'},
      showRegexErrs: {type: 'boolean', default: true},
      imagePreviews: {type: 'boolean', default: true},
      imageLinksExistence: {type: 'boolean', default: true},
      checkDates: {type: 'boolean', default: true}
    },
    advanced: {
      shards: {type: 'number', default: 1},
      batchSize: {type: 'number', default: '400'},
      restrictCookies: {type: 'boolean', default: false},
      processorMethod: {type: 'string', default: 'single'}
    }
  }

  let fatalInvalidConfigs = {}
  let invalidConfigs = {}

  function checkIfRequired (configCategory, configName, errMsg) {
    let config = configTypes[configCategory][configName]
    // if (configName === 'checkDates') console.log(21)
    if (config.default === undefined) fatalInvalidConfigs[configCategory + '.' + configName] = errMsg
    else {
      masterConfig[configCategory][configName] = config.default
      invalidConfigs[configCategory + '.' + configName] = `${errMsg}. Defaulting to ${config.default}`
    }
  }

  // for (var configCategory in masterConfig) {
  for (var configCategory in configTypes) {
    // for (var configName in masterConfig[configCategory]) {
    for (var configName in configTypes[configCategory]) {
      // let configValue = masterConfig[configCategory][configName]
      const configValue = configTypes[configCategory][configName]
      const userConfig =  masterConfig[configCategory][configName]

      if (configValue.type !== typeof userConfig) checkIfRequired(configCategory, configName, `Expected ${configValue.type}, found ${typeof userConfig}`)
      else {
        if (typeof userConfig === 'number' && userConfig < 0) checkIfRequired(configCategory, configName, `Cannot be less than 0`)
        else if (configName === 'menuColor' && userConfig > 16777215) checkIfRequired(configCategory, configName, `Cannot be larger than 16777215`)
        else if (configName === 'sqlType' && (userConfig !== 'sqlite3' && userConfig !== 'mysql')) checkIfRequired(configCategory, configName, 'Must be either "mysql" or "sqlite3"')
        else if (configName === 'processorMethod' && userConfig !== 'single' && userConfig !== 'isolated' && userConfig !== 'parallel') checkIfRequired(configCategory, configName, 'Must be either "single", "isolated", or "parallel"')
        else if (configName === 'controllerIds') {
          for (var i in userConfig) {
            if (typeof userConfig[i] !== 'string') {
              checkIfRequired(configCategory, configName, `Detected non-string value (${userConfig[i]})`)
              break
            }
          }
        }
      }
    }
  }

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
