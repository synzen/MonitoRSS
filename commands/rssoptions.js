const dbOps = require('../util/dbOps.js')
const config = require('../config.json')
const log = require('../util/logger.js')
const MenuUtils = require('../structs/MenuUtils.js')
const FeedSelector = require('../structs/FeedSelector.js')
const PROPERTIES = {
  checkTitles: {
    title: 'Toggle Title Checks for a feed',
    description: `**Only enable this if necessary!** Default is ${config.feeds.checkTitles === true ? 'enabled.' : 'disabled.'} Title checks will ensure no article with the same title as a previous one will be sent for a specific feed.`,
    display: 'Title Checks',
    num: 1
  },
  imgPreviews: {
    title: `Toggle Image Link Previews for a feed's placeholders`,
    description: `Default is ${config.feeds.imgPreviews === false ? 'disabled' : 'enabled'}. Toggle automatic Discord image link embedded previews for image links found inside placeholders such as {description}.`,
    display: 'Image Previews',
    num: 2
  },
  imgLinksExistence: {
    title: `Toggle Image Links Existence for a feed's placeholders`,
    description: `Default is ${config.feeds.imgLinksExistence === false ? 'disabled' : 'enabled'}. Remove image links found inside placeholders such as {description}. If disabled, all image \`src\` links in such placeholders will be removed.`,
    display: 'Image Links Existence',
    num: 3
  },
  checkDates: {
    title: 'Toggle Date Checks for a feed',
    description: `Default is ${config.feeds.checkDates === false ? 'disabled' : 'enabled'}. Date checking ensures that articles that are ${config.feeds.cycleMaxAge} day(s) old or has invalid/no pubdates are't sent.`,
    display: 'Date Checks',
    num: 4
  },
  formatTables: {
    title: 'Toggle Table Formatting for a feed',
    description: `Default is ${config.feeds.formatTables === false ? 'disabled' : 'enabled'}. If table formatting is enabled, they should be enclosed in code blocks to ensure uniform spacing.`,
    display: 'Table Formatting',
    num: 5
  },
  toggleRoleMentions: {
    title: 'Toggle Role Mentioning for Subscriptions',
    description: `Default is ${config.feeds.toggleRoleMentions === false ? 'disabled' : 'enabled'}. Turns on role mentionability for any subscribed roles to a feed when articles are about to send, then immediately turns their mentionability off after the article has been sent. Only applies if roles are below the bot's highest role, and the bot has **Manage Roles** permission.`,
    display: 'Role Mentioning Toggle',
    num: 6
  }
}

async function selectOption (m, data) {
  const input = m.content
  if (input !== '1' && input !== '2' && input !== '3' && input !== '4' && input !== '5' && input !== '6') throw new SyntaxError()
  const num = parseInt(input, 10)
  let chosenProp
  for (var propRef in PROPERTIES) {
    if (PROPERTIES[propRef].num === num) chosenProp = propRef
  }

  return { ...data,
    chosenProp: chosenProp,
    next: {
      menu: new FeedSelector(m, null, { command: data.command, miscOption: chosenProp })
    }}
}

module.exports = async (bot, message, command) => {
  const select = new MenuUtils.Menu(message, selectOption)
    .setAuthor('Miscellaneous Feed Options')
    .setDescription('\u200b\nPlease select an option by typing its number, or type **exit** to cancel.\u200b\n\u200b\n')

  for (var propRef in PROPERTIES) {
    const data = PROPERTIES[propRef]
    select.addOption(data.title, data.description)
  }

  try {
    const data = await new MenuUtils.MenuSeries(message, [select], { command: command }).start()
    if (!data) return
    const { guildRss, rssName, chosenProp } = data
    const source = guildRss.sources[rssName]

    const globalSetting = config.feeds[chosenProp]
    const specificSetting = source[chosenProp]

    let followGlobal = false
    source[chosenProp] = typeof specificSetting === 'boolean' ? !specificSetting : !globalSetting

    const finalSetting = source[chosenProp]

    if (source[chosenProp] === globalSetting) {
      delete source[chosenProp]
      followGlobal = true
    }

    const prettyPropName = PROPERTIES[chosenProp].display

    log.command.info(`${prettyPropName} ${finalSetting ? 'enabling' : 'disabling'} for feed linked ${source.link}. ${followGlobal ? 'Now following global settings.' : ''}`, message.guild)
    await dbOps.guildRss.update(guildRss)
    await message.channel.send(`${prettyPropName} have been ${finalSetting ? 'enabled' : 'disabled'} for <${source.link}>${followGlobal ? ', and is now following the global setting.' : '.'} After completely setting up, it is recommended that you use ${config.bot.prefix}rssbackup to have a personal backup of your settings.`)
  } catch (err) {
    log.command.warning(`rssoptions`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssoptions 1', message.guild, err))
  }
}
