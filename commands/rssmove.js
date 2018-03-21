const log = require('../util/logger.js')
const MenuUtils = require('./util/MenuUtils.js')
const FeedSelector = require('./util/FeedSelector.js')
const MIN_PERMISSION = ['VIEW_CHANNEL', 'SEND_MESSAGES']
const MIN_PERMISSION_USER = ['VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_CHANNELS']
const dbOps = require('../util/dbOps.js')

function inputChannel (m, data, callback) {
  const { guildRss, rssName } = data
  const rssList = guildRss.sources
  const source = rssList[rssName]
  const hasEmbed = source.embedMessage && source.embedMessage.properties
  const sourceChannel = m.guild.channels.get(source.channel)
  const selected = m.mentions.channels.first()
  if (selected.id === sourceChannel.id) return callback(new SyntaxError('The feed is already in that channel. Try again, or type `exit` cancel.'))
  if (!selected) return callback(new SyntaxError('That is not a valid channel. Try again, or type `exit` to cancel.'))
  const me = m.guild.me
  let errors = ''
  if (!me.permissionsIn(selected).has(MIN_PERMISSION)) errors += `\nI am missing **Read Messages** or **Send Messages** permission in <#${selected.id}>.`
  if (hasEmbed && !me.permissionsIn(selected).has('EMBED_LINKS')) errors += `\nI am missing **Embed Links** permission in the <#${selected.id}>. To bypass this permission, you can reset this feed's embed via the rssembed command.`
  if (!m.member.permissionsIn(sourceChannel).has(MIN_PERMISSION_USER)) errors += `\nYou are missing **Read Messages**, **Send Messages**, or **Manage Channel** permission in <#${sourceChannel.id}>.`
  if (!m.member.permissionsIn(selected).has(MIN_PERMISSION_USER)) errors += `\nYou are missing **Read Messages**, **Send Messages**, or **Manage Channel** permission in <#${selected.id}>.`
  for (var n in rssList) {
    const cur = rssList[n]
    if (cur.channel === selected.id && cur.link === source.link && n !== rssName) errors += `\nA feed with this link already exists in that channel.`
  }

  if (errors) return callback(new SyntaxError('Unable to move channel for the following reasons:\n' + errors + '\n\nTry again, or type `exit` to cancel.'))
  source.channel = selected.id
  dbOps.guildRss.update(guildRss)
  log.command.info(`Channel for feed ${source.link} has been moved to channel ${selected.id} (${selected.name})`, m.guild, m.channel)
  m.channel.send(`The channel for the feed <${source.link}> has been moved from <#${m.channel.id}> to <#${selected.id}>`)
  callback(null, data)
}

module.exports = (bot, message, command) => {
  const feedSelector = new FeedSelector(message, null, { command: command })
  const selectChannel = new MenuUtils.Menu(message, inputChannel, { text: 'Mention the channel to move the feed to.' })

  new MenuUtils.MenuSeries(message, [feedSelector, selectChannel]).start(async (err, data) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
    } catch (err) {
      log.command.warning(`rssmove`, message.guild, err)
    }
  })
}
