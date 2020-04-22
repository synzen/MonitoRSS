const { PromptNode } = require('discord.js-prompts')
const movePrompts = require('./prompts/move/index.js')
const runWithFeedGuild = require('./prompts/runner/runWithFeedsProfile.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')

module.exports = async (message, command) => {
  const profile = await Profile.get(message.guild.id)
  const translate = Translator.createProfileTranslator(profile)
  const selectSourceFeedsNode = new PromptNode(movePrompts.selectSourceFeeds.prompt)
  const data = await runWithFeedGuild(selectSourceFeedsNode, message)
  const { sourceFeeds } = data
  if (!sourceFeeds) {
    return
  }
  const removing = await message.channel.send(translate('commands.remove.removing'))
  const errors = []
  const log = createLogger(message.guild.shard.id)
  let removed = translate('commands.remove.success') + '\n```\n'
  for (const feed of sourceFeeds) {
    const link = feed.url
    try {
      await feed.delete()
      removed += `\n${link}`
      log.info({
        guild: message.guild
      }, `Removed feed ${link}`)
    } catch (err) {
      log.error({
        error: err,
        guild: message.guild
      }, `Failed to remove feed ${link}`)
      errors.push(err)
    }
  }
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  if (errors.length > 0) {
    await removing.edit(translate('commands.remove.internalError'))
  } else {
    await removing.edit(`${removed}\`\`\`\n\n${translate('generics.backupReminder', { prefix })}`)
  }
}
