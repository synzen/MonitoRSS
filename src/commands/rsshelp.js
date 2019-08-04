const config = require('../config.js')
const log = require('../util/logger.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const Translator = require('../structs/Translator.js')

module.exports = async (bot, message, command) => {
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const prefix = guildRss && guildRss.prefix ? guildRss.prefix : config.bot.prefix
    const localeToUse = guildRss ? guildRss.locale : config.bot.locale
    const translate = Translator.createLocaleTranslator(localeToUse)
    const webInfo = config.web.enabled && config.web.redirectUri ? ` ${translate('commands.rsshelp.controlPanelLink', { url: config.web.redirectUri.replace('/authorize', '') })}` : ''
    let msg = `${translate('commands.rsshelp.description', { prefix: config.bot.prefix })}${webInfo}\n\n`
    const commandDescriptions = Translator.getCommandDescriptions(localeToUse)
    for (const name in commandDescriptions) {
      const command = commandDescriptions[name]
      if (!command.description) continue
      msg += `\`${prefix}${name}\` - ${command.description}`.replace(/{{prefix}}/g, prefix)
      const args = command.args
      if (args) {
        msg += `\n    **${translate('commands.rsshelp.arguments')}:**\n`
        const argsLength = Object.keys(args).length
        let i = 0
        for (const arg in args) {
          msg += `      \`${arg}\` - ${args[arg]}${i++ === argsLength - 1 ? '' : '\n'}`.replace(/{{prefix}}/g, prefix)
        }
      }
      msg += '\n\n'
    }
    const helpMessage = msg + translate('commands.rsshelp.support')
    message.author.send(helpMessage, { split: { prepend: '\u200b\n' } })
      .then(() => message.reply(translate('commands.rsshelp.checkDM')).catch(err => log.command.warning('Failed to send DM notification in text channel', message.guild, err)))
      .catch(err => {
        log.command.warning(`Failed to direct message help text to user`, message.guild, message.author, err)
        message.channel.send(helpMessage, { split: { prepend: '\u200b\n' } }).catch(err => log.command.warning(`rsshelp`, message.guild, err))
      })
  } catch (err) {
    log.command.warning(`rsshelp`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsshelp 1', message.guild, err))
  }
}
