const config = require('../../config.json')
const commandList = require('../../util/commandList.json')
const channelTracker = require('../../util/channelTracker.js')
const pageControls = require('../../util/pageControls.js')
const storage = require('../../util/storage.js')
const currentGuilds = storage.currentGuilds
const FAIL_LIMIT = config.feeds.failLimit
const log = require('../../util/logger.js')
const Menu = require('./MenuUtils.js').Menu
const MULTI_SELECT = ['rssremove']

function selectFeed (m, data, callback) {
  const command = this.command
  const currentRSSList = this._currentRSSList
  const chosenOption = m.content

  // Return an array of selected indices for feed removal
  if (MULTI_SELECT.includes(command)) {
    let chosenOptionList = chosenOption.split(',').map(item => item.trim()).filter((item, index, self) => item && index === self.indexOf(item))  // Trim items, remove duplicates and empty items
    let valid = []
    let invalid = []

    chosenOptionList.forEach(item => {
      const index = parseInt(item, 10) - 1
      if (isNaN(index) || index + 1 > currentRSSList.length || index + 1 < 1) invalid.push(item)
      else valid.push(index)
    })

    if (invalid.length > 0) return callback(new SyntaxError(`The number(s) \`${invalid}\` are invalid. Try again, or type \`exit\` to cancel.`))
    else {
      for (var q = 0; q < valid.length; ++q) valid[q] = currentRSSList[valid[q]].rssName
      return this.passoverFn(m, { ...data, guildRss: this.guildRss, rssNameList: valid }, callback)
    }
  }

  // Return a single index for non feed removal actions
  const index = parseInt(chosenOption, 10) - 1
  if (isNaN(index) || index + 1 > currentRSSList.length || index + 1 < 1) return callback(new SyntaxError('That is not a valid number. Try again, or type `exit` to cancel.'))

  // Data is pre-passed into a FeedSelector's fn, merged with the previous Menu's data
  this.passoverFn(m, { ...data, guildRss: this.guildRss, rssName: currentRSSList[index].rssName }, callback)
}

/**
 * A menu with predefined passover data with feed information, merged with any previous menu's data.
 *
 * @extends {Menu}
 */
class FeedSelector extends Menu {
  /**
   * Creates an instance of FeedSelector.
   * @param {Oject} message Instance of a Discord.js Message
   * @param {Function} [passoverFn]  Function with predefined passover data in the second parameter
   * @param {Object} [cmdInfo] Command information
   * @param {String} [cmdInfo.command] Command name
   * @param {String} [cmdInfo.miscOption] Description of the miscoption by rssoptions
   * @memberof FeedSelector
   */
  constructor (message, passoverFn, cmdInfo) {
    super(message)
    if (!passoverFn) passoverFn = (m, data, callback) => callback(null, data)
    this.passoverFn = passoverFn
    this.guildRss = currentGuilds.get(message.guild.id)
    if (!this.guildRss || !this.guildRss.sources || Object.keys(this.guildRss.sources).length === 0) {
      this.text = 'There are no existing feeds.'
      return
    }
    const { command, miscOption } = cmdInfo
    this.command = command
    this.miscOption = miscOption

    const rssList = this.guildRss.sources
    const maxFeedsAllowed = storage.limitOverrides[message.guild.id] != null ? storage.limitOverrides[message.guild.id] === 0 ? 'Unlimited' : storage.limitOverrides[message.guild.id] : (!config.feeds.max || isNaN(parseInt(config.feeds.max, 10))) ? 'Unlimited' : config.feeds.max

    this._currentRSSList = []

    for (var rssName in rssList) { // Generate the info for each feed as an object, and push into array to be used in pages that are sent
      const source = rssList[rssName]
      let o = { link: source.link, rssName: rssName, title: source.title }
      if (commandList[command].action === 'Refresh Feed') {
        const failCount = storage.failedLinks[source.link]
        o.status = !failCount || (typeof failCount === 'number' && failCount <= FAIL_LIMIT) ? `Status: OK ${failCount > Math.ceil(FAIL_LIMIT / 10) ? '(' + failCount + '/' + FAIL_LIMIT + ')' : ''}\n` : `Status: FAILED\n`
      }
      if (miscOption === 'imagePreviews' || miscOption === 'imageLinksExistence' || miscOption === 'checkTitles' || miscOption === 'checkDates') {
        const statusText = miscOption === 'imagePreviews' ? 'Image Link Previews: ' : miscOption === 'imageLinksExistence' ? 'Image Links Existence: ' : miscOption === 'checkTitles' ? 'Title Checks: ' : 'Date Checks: '
        let decision = ''

        const globalSetting = config.feeds[miscOption]
        decision = globalSetting ? `${statusText} Enabled\n` : `${statusText} Disabled\n`
        const specificSetting = source[miscOption]
        decision = typeof specificSetting !== 'boolean' ? decision : specificSetting === true ? `${statusText} Enabled\n` : `${statusText} Disabled\n`

        o[miscOption] = decision
      }
      if (message.channel.id === source.channel) this._currentRSSList.push(o)
    }

    if (this._currentRSSList.length === 0) {
      this.text = 'No feeds assigned to this channel.'
      return
    }
    let desc = maxFeedsAllowed === 'Unlimited' ? '' : `**Server Limit:** ${Object.keys(rssList).length}/${maxFeedsAllowed}\n`
    desc += `**Channel:** #${message.channel.name}\n**Action**: ${command === 'rssoptions' ? commandList[command].options[miscOption] : commandList[command].action}\n\nChoose a feed to from this channel by typing the number to execute your requested action on. ${MULTI_SELECT.includes(command) ? 'You may select multiple feeds by separation with commas. ' : ''}Type **exit** to cancel.\u200b\n\u200b\n`
    this.setAuthor('Feed Selection Menu')
    this.setDescription(desc)

    this._currentRSSList.forEach(item => {
      const link = item.link
      const title = item.title
      const status = item.status || ''
      const miscOption = item.checkTitles || item.imagePreviews || item.imageLinksExistence || item.checkDates || ''
      this.addOption(`${title.length > 200 ? title.slice(0, 200) + ' ...' : title}`, `${miscOption}${status}Link: ${link.length > 500 ? '*Exceeds 500 characters*' : link}`)
    })

    this.fn = selectFeed.bind(this)
  }

  /**
   * Callback function for sending a Menu
   *
   * @callback sendCallback
   * @param {Error} err SyntaxError if incorrect input for retry, or other Error to stop the collector.
   * @param {Object} data Data at the end of a Menu passed over
   * @param {MessageCleaner} msgCleaner MessageCleaner containing the messages collected thus far
   * @param {Boolean} endPrematurely Prematurely end a MenuSeries if it exists, calling its callback
   */

  /**
   * Send the text and/or embed with pagination if needed
   *
   * @param {Object} data
   * @param {sendCallback} callback
   * @override
   * @memberof FeedSelector
   */
  async send (data, callback) {
    if (this.pages.length > 1) this.pages[0].setFooter(`Page 1/${this.pages.length}`)

    try {
      const m = await this.channel.send(this.text, { embed: this.pages[0] })
      this._msgCleaner.add(m)
      if (this.pages.length > 1) {
        await m.react('◀')
        await m.react('▶')
        pageControls.add(m.id, this.pages)
      }

      if (!this.fn) return

      const collector = this.channel.createMessageCollector(m => m.author.id === this.message.author.id, {time: 60000})
      // Add a channel tracker to prohibit any other commands while the Menu is in use
      channelTracker.add(this.channel.id)

      collector.on('collect', m => {
        this._msgCleaner.add(m)
        if (m.content.toLowerCase() === 'exit') return collector.stop('Menu closed.')

        // Call the function defined in the constructor
        this.fn(m, data, (err, passover, endPrematurely) => {
          // SyntaxError allows input retries for this collector due to incorrect input
          if (err instanceof SyntaxError) return m.channel.send(err.message).then(m => this._msgCleaner.add(m))
          collector.stop()
          // Callback and pass over the data to the next function (if a MenuSeries, then to the next Menu's function)
          callback(err, passover, this._msgCleaner, endPrematurely)
        })
      })

      collector.on('end', (collected, reason) => { // Reason is the parameter inside collector.stop(reason)
        // Remove the channel tracker to allow commands in this channel again
        channelTracker.remove(this.channel.id)
        if (reason === 'user') return
        if (reason === 'time') this.channel.send(`I have closed the menu due to inactivity.`).catch(err => log.command.warning(`Unable to send expired menu message`, this.channel.guild, err))
        else this.channel.send(reason).then(m => m.delete(6000))
      })
    } catch (err) {
      log.command.warning(`Failed to send Menu`, this.channel.guild, err)
      callback(err, { __end: true })
    }
  }
}

module.exports = FeedSelector
