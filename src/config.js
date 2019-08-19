const fs = require('fs')
const path = require('path')
const config = require('./config.json')
const checkConfig = require('./util/checkConfig.js')
const ENV_PREFIX = 'DRSS'

function resolveWithEnv (variableName, configValue, configSpecification) {
  const value = process.env[variableName]
  if (variableName === `${ENV_PREFIX}__VIP` || variableName === `${ENV_PREFIX}__VIPREFRESHRATEMINUTES`) {
    return configValue
  }
  switch (variableName) {
    case `${ENV_PREFIX}BOT_TOKEN`:
      return !value || value === 'drss_docker_token' ? (configValue || 's') : value
    case `${ENV_PREFIX}DATABASE_URI`:
      return value || process.env.MONGODB_URI || configValue // MONGODB_URI may be set by Heroku
    case `${ENV_PREFIX}DATABASE_REDIS`:
      return value || process.env.REDIS_URL || configValue // REDIS_URL may be set by Heroku
    case `${ENV_PREFIX}FEEDS_DEFAULTMESSAGE`:
      return value ? value.replace(/\\n/g, '\n') : configValue
    default:
      switch (configSpecification.type) {
        case Number:
          return Number(value) || configValue
        case Boolean:
          return value === 'true'
        case Array:
          return value ? value.split(/\s*,\s*/) : configValue
        default:
          return configValue
      }
  }
}

function traverse (object, objectOverride, envName, printOverrides, configSpecification = checkConfig.defaultConfigs) {
  for (const key in object) {
    if (key === '_overrideWith' || key === 'commandAliases' || key === 'decode') {
      continue
    }
    if (Object.prototype.toString.call(object[key]) === '[object Object]') {
      traverse(object[key], objectOverride ? objectOverride[key] : undefined, envName + `_${key.toUpperCase()}`, printOverrides, configSpecification[key])
    } else {
      const envVariableName = `${envName}_${key.toUpperCase()}`
      object[key] = resolveWithEnv(envVariableName, object[key], configSpecification[key])
      if (objectOverride && objectOverride[key] !== undefined && objectOverride[key] !== object[key]) {
        object[key] = objectOverride[key]
      }
    }
  }
}

function overrideConfigs (configOverrides, printWarnings, printOverrides) {
  if (configOverrides._vip === true) {
    config._vip = true
    config._vipRefreshRateMinutes = configOverrides._vipRefreshRateMinutes
  }
  traverse(config, configOverrides, ENV_PREFIX, printOverrides)
  const results = checkConfig.check(config)
  if (results) {
    if (results.fatal) {
      throw new Error(results.message)
    } else if (results.message && printWarnings) {
      console.log(results.message)
    }
  }
}

const overrideFilePath = path.join(__dirname, '..', 'settings', 'configOverride.json')

if (fs.existsSync(overrideFilePath)) {
  overrideConfigs(JSON.parse(fs.readFileSync(overrideFilePath)), process.env.DRSS)
} else {
  overrideConfigs(undefined, process.env.DRSS)
}

config._overrideWith = override => overrideConfigs(override, false, true)

module.exports = config
