const fetch = require('node-fetch')
const Profile = require('../structs/db/Profile.js')
const Translator = require('../structs/Translator.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')

module.exports = async (message) => {
  const config = getConfig()
  const webURL = config.webURL
  if (!webURL) {
    return message.channel.send('A web URL is required to be defined in config for this command.')
  }
  const profile = await Profile.get(message.guild.id)
  const translate = Translator.createProfileTranslator(profile)
  const log = createLogger(message.client.shard.ids[0])
  const split = message.content.split(' ')
  let searchTerm = split.slice(1, split.length).join(' ').trim()
  if (!searchTerm) {
    return message.channel.send(translate('commands.faq.searchQueryRequired'))
  }
  if (searchTerm === '^') {
    const fetched = (await message.channel.messages.fetch({
      limit: 1,
      before: message.id
    }, false)).first()
    searchTerm = fetched.content
  }
  log.info(`Searching "${searchTerm}"`)
  const fetchingMessage = await message.channel.send(translate('commands.faq.searching'))
  const res = await fetch(`${webURL}/api/faq?search=${searchTerm}`)
  if (res.status !== 200) {
    throw new Error(`${res.status} status code response`)
  }
  const faqDocuments = await res.json()
  await fetchingMessage.delete()
  if (faqDocuments.length === 0) {
    return message.channel.send(translate('commands.faq.noResults'))
  }
  const best = faqDocuments[0]
  return message.channel.send(`**${best.q}**\n\n${best.a}`)
}
