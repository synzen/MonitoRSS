const config = require('../config.js')
const commands = require('../util/commands.js').list
const log = require('../util/logger.js')

module.exports = (bot, message, command) => {
  const webInfo = config.web.enabled && config.web.redirectUri ? ` Be sure to check out your control panel at ${config.web.redirectUri.replace('/authorize', '')} for easy feed management!` : ''
  let msg = `Arguments for commands are added after the command. For example: \`${config.bot.prefix}rsstest simple\`.${webInfo}\n\n`
  for (var name in commands) {
    const command = commands[name]
    if (!command.description) continue
    msg += `\`${config.bot.prefix}${name}\` - ${command.description}`
    const args = command.args
    if (args) {
      msg += `\n    **Arguments:**\n`
      for (var arg in args) msg += `      \`${arg}\` - ${args[arg]}`
    }
    msg += '\n\n'
  }
  const helpMessage = msg + '\nSupport can be found at https://discord.gg/pudv7Rx'
  message.author.send(helpMessage, { split: { prepend: '\u200b\n' } })
    .then(() => message.reply('Check your DM!').catch(err => log.command.warning('Failed to send DM notification in text channel', message.guild, err)))
    .catch(err => {
      log.command.warning(`Failed to direct message help text to user`, message.guild, message.author, err)
      message.channel.send(helpMessage, { split: { prepend: '\u200b\n' } }).catch(err => log.command.warning(`rsshelp`, message.guild, err))
    })
}
