const fs = require('fs')
const path = require('path')
const config = require('./config.json')
const checkConfig = require('./util/checkConfig.js')
const COLORS = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  CYAN: '\x1b[36m'
}
const ENV_PREFIX = 'DRSS_'
const SKIP_TYPE_CHECKS = ['_vip', '_vipRefreshRateMinutes', 'dev'].map(item => ENV_PREFIX + item.toUpperCase())
const EXCLUDED_CONFIG_KEYS = ['_overrideWith', 'commandAliases', 'decode']

function resolveWithEnv (variableName, configValue, configSpecification) {
  if (SKIP_TYPE_CHECKS.includes(variableName)) {
    return configValue
  }
  const value = process.env[variableName]
  switch (variableName) {
    case `${ENV_PREFIX}BOT_TOKEN`:
      return !value || value === 'drss_docker_token' ? (configValue || 's') : value
    case `${ENV_PREFIX}DATABASE_URI`:
      return value || process.env.MONGODB_URI || configValue // MONGODB_URI may be set by Heroku
    case `${ENV_PREFIX}DATABASE_REDIS`:
      return value || process.env.REDIS_URL || configValue // REDIS_URL may be set by Heroku
    case `${ENV_PREFIX}FEEDS_DEFAULTMESSAGE`:
      return value ? value.replace(/\\n/g, '\n') : configValue
    case `${ENV_PREFIX}WEB_PORT`:
      const port = value || process.env.PORT || configValue // PORT may be set by Heroku
      return port ? Number(port) : port
    default:
      switch (configSpecification.type) {
        case Number:
          return value ? Number(value) : configValue
        case Boolean:
          return value && value === 'true' ? true : configValue
        case Array:
          return value ? value.split(/\s*,\s*/) : configValue
        default:
          return configValue
      }
  }
}

function traverse (object, objectOverride, location, printOverrides, configSpecification = checkConfig.defaultConfigs) {
  for (const key in object) {
    if (EXCLUDED_CONFIG_KEYS.includes(key)) {
      continue
    }
    const currentLocation = location ? `${location}.${key}` : key
    if (Object.prototype.toString.call(object[key]) === '[object Object]') {
      traverse(object[key], objectOverride ? objectOverride[key] : undefined, currentLocation, printOverrides, configSpecification[key])
    } else {
      const envVariableName = `${ENV_PREFIX}${currentLocation.replace(/\./g, '_').toUpperCase()}`
      const resolvedValue = resolveWithEnv(envVariableName, object[key], configSpecification[key])
      if (printOverrides && object[key] !== resolvedValue) {
        console.log(`Replacing ${COLORS.CYAN}config.${location}.${key}${COLORS.RESET} value of ${COLORS.RED}${object[key]}${COLORS.RESET} with ${COLORS.GREEN}${resolvedValue}${COLORS.RESET} from process.env.${envVariableName}`)
      }
      object[key] = resolvedValue
      if (objectOverride && objectOverride[key] !== undefined && objectOverride[key] !== object[key]) {
        if (printOverrides && objectOverride[key] !== object[key]) {
          console.log(`Replacing ${COLORS.CYAN}config.${location}.${key}${COLORS.RESET} value of ${COLORS.RED}${object[key]}${COLORS.RESET} with ${COLORS.GREEN}${objectOverride[key]}${COLORS.RESET} from config override`)
        }
        object[key] = objectOverride[key]
      }
    }
  }
}

function overrideConfigs (configOverrides, printWarnings, printOverrides) {
  if (configOverrides && configOverrides._vip === true) {
    config._vip = true
    config._vipRefreshRateMinutes = configOverrides._vipRefreshRateMinutes
  }
  if (configOverrides && configOverrides.dev === true) {
    config.dev = true
  }
  traverse(config, configOverrides, '', printOverrides)
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

config._overrideWith = override => overrideConfigs(override, true, true)

module.exports = config
