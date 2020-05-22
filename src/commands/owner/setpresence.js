const Joi = require('@hapi/joi')
const getConfig = require('../../config.js').get
const createLogger = require('../../util/logger/create.js')
const schema = Joi.object({
  status: Joi.string().valid('online', 'idle', 'invisible', 'dnd'),
  activity: Joi.object({
    name: Joi.string(),
    type: Joi.string().valid('PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'CUSTOM_STATUS'),
    url: Joi.string().when('type', {
      is: 'STREAMING',
      then: Joi.string().required()
    })
  })
})

function getPresenceFromArgs (args) {
  const status = args[0]
  const activityType = args[1]
  const activityName = args[1] === 'STREAMING' ? args.slice(2, args.length - 1).join(' ') : args.slice(2).join(' ')
  const activityURL = args[1] === 'STREAMING' ? args[args.length - 1] : ''
  const presenceData = {}
  if (status) {
    presenceData.status = status
  }
  if (activityType) {
    presenceData.activity = {
      type: activityType
    }
    if (activityName) {
      presenceData.activity.name = activityName
    }
    if (activityURL) {
      presenceData.activity.url = activityURL
    }
  }
  return presenceData
}

function setConfig (presenceData) {
  const config = getConfig()
  if (presenceData.status) {
    config.bot.status = presenceData.status
  }
  if (presenceData.activity.type) {
    config.bot.activityType = presenceData.activity.type
  }
  if (presenceData.activity.name) {
    config.bot.activityName = presenceData.activity.name
  }
  if (presenceData.activity.url) {
    config.bot.streamActivityURL = presenceData.activity.url
  }
}

module.exports = async (message) => {
  const args = message.content.split(' ').map(s => s.trim()).filter(s => s)
  args.shift()
  if (args.length === 0) {
    return message.channel.send('Insufficient number of arguments.')
  }
  const presenceData = getPresenceFromArgs(args)
  const results = schema.validate(presenceData, {
    abortEarly: false
  })
  if (results.error) {
    const str = results.error.details.map(d => d.message).join('\n')
    return message.channel.send(`Invalid format. Errors:\n\n${str}`)
  }
  setConfig(presenceData)
  const config = getConfig()
  await message.client.user.setPresence(presenceData)
  await message.client.shard.broadcastEval(`
    const path = require('path');
    const appDir = path.dirname(require.main.filename);
    const config = require(appDir + '/src/config.js').get();
    config.bot = JSON.parse(\`${JSON.stringify(config.bot)}\`)
  `)
  const log = createLogger(message.guild.shard.id)
  log.owner({
    user: message.author,
    presenceData
  }, 'Set presence')
  await message.channel.send('Successfully changed presence. It may be some time until it shows due to rate limiting.')
}
