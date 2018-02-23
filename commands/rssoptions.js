const fileOps = require('../util/fileOps.js')
const config = require('../config.json')
const log = require('../util/logger.js')
const MenuUtils = require('./util/MenuUtils.js')
const FeedSelector = require('./util/FeedSelector.js')

function selectOption (m, data, callback) {
  const input = m.content
  if (input !== '1' && input !== '2' && input !== '3' && input !== '4') return callback(new SyntaxError(`That is not a valid option. Try again, or type \`exit\` to cancel.`))
  const chosenProp = m.content === '1' ? 'checkTitles' : m.content === '2' ? 'imgPreviews' : m.content === '3' ? 'imgLinksExistence' : 'checkDates'

  callback(null, { ...data,
    chosenProp: chosenProp,
    next: {
      add: new FeedSelector(m, null, { command: data.command, miscOption: chosenProp })
    }})
}

module.exports = (bot, message, command) => {
  const select = new MenuUtils.Menu(message, selectOption)
    .setAuthor('Miscellaneous Feed Options')
    .setDescription('\u200b\nPlease select an option by typing its number, or type **exit** to cancel.\u200b\n\u200b\n')
    .addOption('Toggle Title Checks for a feed', `**Only enable this if necessary!** Default is ${config.feedSettings.checkTitles === true ? 'enabled.' : 'disabled.'} Title checks will ensure no article with the same title as a previous one will be sent for a specific feed.`)
    .addOption('Toggle Image Link Previews for a feed', `Default is ${config.feedSettings.imgPreviews === false ? 'disabled' : 'enabled'}. Toggle automatic Discord image link embedded previews for image links found inside placeholders such as {description}.`)
    .addOption('Toggle Image Links Existence for a feed', `Default is ${config.feedSettings.imgLinksExistence === false ? 'disabled' : 'enabled'}. Remove image links found inside placeholders such as {description}. If disabled, all image \`src\` links in such placeholders will be removed.`)
    .addOption('Toggle Date Checks for a feed', `Default is ${config.feedSettings.checkDates === false ? 'disabled' : 'enabled'}. Date checking ensures that articles that are ${config.feedSettings.cycleMaxAge} day(s) old or has invalid/no pubdates are't sent.`)

  new MenuUtils.MenuSeries(message, [select], { command: command }).start(async (err, data) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const { guildRss, rssName, chosenProp } = data
      const source = guildRss.sources[rssName]

      const globalSetting = config.feedSettings[chosenProp]
      const specificSetting = source[chosenProp]

      let followGlobal = false
      source[chosenProp] = typeof specificSetting === 'boolean' ? !specificSetting : !globalSetting

      const finalSetting = source[chosenProp]

      if (source[chosenProp] === globalSetting) {
        delete source[chosenProp]
        followGlobal = true
      }

      const prettyPropName = chosenProp === 'checkTitles' ? 'Title Checks' : chosenProp === 'imgPreviews' ? 'Image Previews' : chosenProp === 'imgLinksExistence' ? 'Image Links Existence' : 'Date Checks'

      fileOps.updateFile(guildRss)
      log.command.info(`${prettyPropName} ${finalSetting ? 'enabled' : 'disabled'} for feed linked ${source.link}. ${followGlobal ? 'Now following global settings.' : ''}`, message.guild)
      await message.channel.send(`${prettyPropName} have been ${finalSetting ? 'enabled' : 'disabled'} for <${source.link}>${followGlobal ? ', and is now following the global setting.' : '.'}`)
    } catch (err) {
      log.comamnd.warning(`rssoptions`, message.guild, err)
    }
  })
}
