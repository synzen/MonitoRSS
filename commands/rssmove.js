const log = require('../util/logger.js')
const MenuUtils = require('./util/MenuUtils.js')
const FeedSelector = require('./util/FeedSelector.js')
const MIN_PERMISSION = ['VIEW_CHANNEL', 'SEND_MESSAGES']
const dbOps = require('../util/dbOps.js')

function inputChannel (m, data, callback) {
    const { guildRss, rssName } = data
    const source = guildRss.sources[rssName]
    const hasEmbed = source.embedMessage && source.embedMessage.properties
    const guild = m.guild
    const selected = m.mentions.channels.first()
    if (!selected) return callback(new SyntaxError('That is not a valid channel. Try again, or type `exit` to cancel.'))
    const me = m.guild.me
    let errors = ''
    if (!me.permissionsIn(selected).has(MIN_PERMISSION)) errors += '\nI am missing **View Channel/Read Messages** or **Send Messages** permission.'
    if (hasEmbed && !me.permissionsIn(selected).has('EMBED_LINKS')) errors += `\nI am missing **Embed Links** permission. To bypass this permission, you can reset this feed's embed via the rssembed command.`
    if (!m.member.permissionsIn(selected).has(MIN_PERMISSION)) errors += '\nYou are missing **View Channel/Read Messages** or **Send Messages** permission.'
    if (errors) return callback(new SyntaxError('Unable to move channel for the following reasons:\n' + errors + '\n\nTry again, or type `exit` to cancel.'))
    source.channel = selected.id
    dbOps.guildRss.update(guildRss)
    log.command.info(`Channel for feed ${source.link} has been moved to channel ${selected.id} (${selected.name})`, m.guild, m.channel)
    m.channel.send(`The channel for the feed <${source.link}> has been moved from <#${m.channel.id}> to <#${selected.id}>`)
    callback(null, data)
}

module.exports = (bot, message, command) => {
    const feedSelector = new FeedSelector(message, null, { command: command })
    const selectChannel = new MenuUtils.Menu(message, inputChannel, { text: 'Mention the channel to move the feed to. Note that I, as well as you, must be able to read and send messages in the chosen channel.' })

    new MenuUtils.MenuSeries(message, [feedSelector, selectChannel]).start(async (err, data) => {
        try {
          if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
        } catch (err) {
          log.command.warning(`rssmessage`, message.guild, err)
        }
      })
}