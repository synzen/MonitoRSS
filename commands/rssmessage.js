const fileOps = require('../util/fileOps.js')
const config = require('../config.json')
const log = require('../util/logger.js')
const MenuUtils = require('./util/MenuUtils.js')
const FeedSelector = require('./util/FeedSelector.js')

function feedSelectorFn (m, data, callback) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]
  const currentMsg = source.message ? '```Markdown\n' + source.message + '```' : '```Markdown\nNone has been set. Currently using default message below:\n\n``````\n' + config.feedSettings.defaultMessage + '```'

  callback(null, { guildRss: guildRss,
    rssName: rssName,
    next: {
      text: `The current message for ${source.link} is: \n${currentMsg}\nType your new customized message now, type \`reset\` to use the default message, or type \`exit\` to cancel. \n\nRemember that you can use the placeholders \`{title}\`, \`{description}\`, \`{link}\`, and etc. \`{empty}\` will create an empty message, but only if an embed is used. Regular formatting such as **bold** and etc. is also available. To find other placeholders, type \`exit\` then \`${config.botSettings.prefix}rsstest\`.\n\n` }
  })
}

function setMessage (m, data, callback) {
  const { guildRss, rssName } = data
  const source = guildRss.sources[rssName]
  const input = m.content

  if (input.toLowerCase() === 'reset') callback(null, { setting: null, guildRss: guildRss, rssName: rssName })
  else if (input === '{empty}' && (typeof source.embedMessage !== 'object' || typeof source.embedMessage.properties !== 'object' || Array.isArray(source.embedMessage.properties) || Object.keys(source.embedMessage.properties).length === 0)) {
    callback(new SyntaxError('You cannot have an empty message if there is no embed used for this feed. Try again.')) // Allow empty messages only if embed is enabled
  } else callback(null, { setting: input, guildRss: guildRss, rssName: rssName })
}

module.exports = (bot, message, command) => {
  const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command })
  const messagePrompt = new MenuUtils.Menu(message, setMessage)

  new MenuUtils.MenuSeries(message, [feedSelector, messagePrompt]).start(async (err, data) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const { setting, guildRss, rssName } = data
      const source = guildRss.sources[rssName]

      if (setting === null) {
        const m = await message.channel.send(`Resetting message...`)
        delete guildRss.sources[rssName].message
        fileOps.updateFile(guildRss)
        log.command.info(`Message reset for ${source.link}`, message.guild)
        await m.edit(`Message reset and using default message:\n \`\`\`Markdown\n${config.feedSettings.defaultMessage}\`\`\` \nfor feed ${source.link}`)
      } else {
        const m = await message.channel.send(`Updating message...`)
        source.message = setting
        fileOps.updateFile(guildRss)
        log.command.info(`New message recorded for ${source.link}`, message.guild)
        await m.edit(`Message recorded:\n \`\`\`Markdown\n${setting}\`\`\` \nfor feed <${source.link}>. You may use \`${config.botSettings.prefix}rsstest\` to see your new message format.`)
      }
    } catch (err) {
      log.command.warning(`rssmessage`, message.guild, err)
    }
  })
}
