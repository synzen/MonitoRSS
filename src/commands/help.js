const Profile = require('../structs/db/Profile.js')
const Translator = require('../structs/Translator.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')

module.exports = async (message, command) => {
  const profile = await Profile.get(message.guild.id)
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const localeToUse = profile ? profile.locale : config.bot.locale
  const translate = Translator.createLocaleTranslator(localeToUse)
  const webInfo = config.webURL ? ` ${translate('commands.help.controlPanelLink', {
    url: config.webURL
  })}` : ''
  let msg = `${webInfo} ${translate('commands.help.description', { prefix: config.bot.prefix })}\n\n`
  const commandDescriptions = Translator.getCommandDescriptions(localeToUse)
  for (const name in commandDescriptions) {
    const command = commandDescriptions[name]
    if (!command.description) continue
    msg += `\`${prefix}${name}\` - ${command.description}`.replace(/{{prefix}}/g, prefix)
    const args = command.args
    if (args) {
      msg += `\n    **${translate('commands.help.arguments')}:**\n`
      const argsLength = Object.keys(args).length
      let i = 0
      for (const arg in args) {
        msg += `      \`${arg}\` - ${args[arg]}${i++ === argsLength - 1 ? '' : '\n'}`.replace(/{{prefix}}/g, prefix)
      }
    }
    msg += '\n\n'
  }
  const helpMessage = msg + translate('commands.help.support')
  return message.author.send(helpMessage, { split: { prepend: '\u200b\n' } })
    .then(() => {
      message.reply(translate('commands.help.checkDM'))
        .catch(err => {
          const log = createLogger(message.guild.shard.id)
          log.warn({
            error: err,
            user: message.author
          }, 'Failed to send DM notification in text channel')
        })
    })
    .catch(err => {
      const log = createLogger(message.guild.shard.id)
      log.warn({
        error: err,
        user: message.author
      }, 'Failed to direct message help text to user')
      return message.channel.send(helpMessage, { split: { prepend: '\u200b\n' } })
    })
}
