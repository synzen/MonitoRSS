const Joi = require('@hapi/joi')
const decodeValidator = require('./validation/decode.js')
const timezoneValidator = require('./validation/timezone.js')
const localeValidator = require('./validation/locale.js')

const schema = Joi.object({
  dev: Joi.bool().strict(),
  _vip: Joi.bool().strict(),
  log: Joi.object({
    destination: Joi.string().allow('').strict().required(),
    linkErrs: Joi.bool().strict().required(),
    unfiltered: Joi.bool().strict().required(),
    failedFeeds: Joi.bool().strict().required()
  }).required(),
  bot: Joi.object({
    token: Joi.string().required(),
    locale: localeValidator.config().locale(),
    enableCommands: Joi.bool().strict().required(),
    prefix: Joi.string().required(),
    status: Joi.string().valid('online', 'dnd', 'invisible', 'idle').required(),
    activityType: Joi.string().valid('', 'PLAYING', 'STREAMING', 'LISTENING', 'WATCHING').required(),
    activityName: Joi.string().allow('').required(),
    streamActivityURL: Joi.string().allow('').required(),
    ownerIDs: Joi.array().items(Joi.string()).required(),
    menuColor: Joi.number().strict().greater(0).required(),
    deleteMenus: Joi.bool().strict().required(),
    exitOnSocketIssues: Joi.bool().strict().required()
  }).required(),
  database: Joi.object({
    uri: Joi.string().required(),
    redis: Joi.string().allow('').required(),
    connection: Joi.object().required(),
    articlesExpire: Joi.number().strict().greater(-1).required()
  }),
  feeds: Joi.object({
    refreshRateMinutes: Joi.number().strict().greater(0).required(),
    timezone: timezoneValidator.config().timezone(),
    dateFormat: Joi.string().required(),
    dateLanguage: Joi.string().required(),
    dateLanguageList: Joi.array().items(Joi.string()).min(1).required(),
    dateFallback: Joi.bool().strict().required(),
    timeFallback: Joi.bool().strict().required(),
    max: Joi.number().strict().greater(-1).required(),
    hoursUntilFail: Joi.number().strict().required(),
    notifyFail: Joi.bool().strict().required(),
    sendFirstCycle: Joi.bool().strict().required(),
    cycleMaxAge: Joi.number().strict().required(),
    defaultText: Joi.string().required(),
    imgPreviews: Joi.bool().strict().required(),
    imgLinksExistence: Joi.bool().strict().required(),
    checkDates: Joi.bool().strict().required(),
    formatTables: Joi.bool().strict().required(),
    decode: decodeValidator.config().encoding()
  }).required(),
  advanced: Joi.object({
    shards: Joi.number().greater(0).strict().required(),
    batchSize: Joi.number().greater(0).strict().required(),
    parallelBatches: Joi.number().greater(0).strict().required()
  }).required(),
  web: Joi.object({
    enabled: Joi.bool().strict().required(),
    trustProxy: Joi.bool().strict().required(),
    port: Joi.number().strict().required(),
    sessionSecret: Joi.string().allow('').required().when('enabled', {
      is: true,
      then: Joi.string().disallow('').required()
    }),
    redirectURI: Joi.string().allow('').required().when('enabled', {
      is: true,
      then: Joi.string().disallow('').required()
    }),
    clientID: Joi.string().allow('').required().when('enabled', {
      is: true,
      then: Joi.string().disallow('').required()
    }),
    clientSecret: Joi.string().allow('').required().when('enabled', {
      is: true,
      then: Joi.string().disallow('').required()
    }),
    https: Joi.object({
      enabled: Joi.bool().strict().required(),
      privateKey: Joi.string().allow('').required().when('enabled', {
        is: true,
        then: Joi.string().disallow('').required()
      }),
      certificate: Joi.string().allow('').required().when('enabled', {
        is: true,
        then: Joi.string().disallow('').required()
      }),
      chain: Joi.string().allow('').required().when('enabled', {
        is: true,
        then: Joi.string().disallow('').required()
      }),
      port: Joi.number().strict().required()
    }).required()
  }).required()
})

module.exports = {
  validate: config => {
    const results = schema.validate(config, {
      abortEarly: false
    })
    if (results.error) {
      const str = results.error.details
        .map(d => d.message)
        .join('\n')

      throw new TypeError(`Config validation failed\n${str}\n`)
    }
  }
}
