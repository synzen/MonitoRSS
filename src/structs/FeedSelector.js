const config = require('../config.js')
const channelTracker = require('../util/channelTracker.js')
const pageControls = require('../util/pageControls.js')
const log = require('../util/logger.js')
const { Menu, MenuOptionError } = require('./MenuUtils.js')
const Translator = require('./Translator.js')
const MULTI_SELECT = ['rssremove', 'rssmove']
const GLOBAL_SELECT = ['rssmove']
const SINGLE_NUMBER_REGEX = /^\d+$/
const getOptionTexts = translate => ({
  imgPreviews: {
    status: `${translate('commands.rssoptions.imagePreviews')}: `,
    toggle: translate('commands.rssoptions.imagePreviewsDescription')
  },
  imgLinksExistence: {
    status: `${translate('commands.rssoptions.imageLinksExistence')}: `,
    toggle: translate('commands.rssoptions.imageLinksExistenceToggle')
  },
  checkTitles: {
    status: `${translate('commands.rssoptions.titleChecks')}: `,
    toggle: translate('commands.rssoptions.titleChecksToggle')
  },
  checkDates: {
    status: `${translate('commands.rssoptions.dateChecks')}: `,
    toggle: translate('commands.rssoptions.dateChecksToggle')
  },
  formatTables: {
    status: `${translate('commands.rssoptions.tableFormatting')}: `,
    toggle: translate('commands.rssoptions.tableFormattingToggle')
  },
  toggleRoleMentions: {
    status: `${translate('commands.rssoptions.roleMentioning')}: `,
    toggle: translate('commands.rssoptions.roleMentioningToggle')
  }
})

function parseNumbers (str) {
  if (SINGLE_NUMBER_REGEX.test(str)) return [parseInt(str, 10)]
  const multi = /^(\d+)-(\d+)$/.exec(str)
  if (!multi) return
  const min = parseInt(multi[1], 10)
  const max = parseInt(multi[2], 10)
  if (min > max) return
  const arr = []
  for (var i = min; i <= max; ++i) arr.push(i)
  return arr
}

async function selectFeedFn (m, data, callback) {
  const currentRSSList = this._currentRSSList
  const chosenOption = m.content

  // Return an array of selected indices for feed removal
  if (this.multiSelect) {
    let chosenOptionList = chosenOption.split(',').map(item => item.trim()).filter((item, index, self) => item && index === self.indexOf(item)) // Trim items, remove duplicates and empty items
    let valid = []
    let invalid = []

    // Validate user choices
    for (var i = 0; i < chosenOptionList.length; ++i) {
      const input = chosenOptionList[i]
      const numbers = parseNumbers(input)
      if (!numbers) invalid.push(input)
      else {
        for (var j = 0; j < numbers.length; ++j) {
          const num = numbers[j]
          if (num < 1) invalid.push(num) // Do not push in any numbers greater than the currentRSSList length
          else if (num <= currentRSSList.length && !valid.includes(num - 1)) valid.push(num - 1) // Push the index to be used
        }
      }
    }

    // Replace the indices in valid with their respective rssNames in currentRSSList
    if (invalid.length > 0 || valid.length === 0) throw new MenuOptionError()
    else {
      for (var q = 0; q < valid.length; ++q) valid[q] = currentRSSList[valid[q]].rssName
      return this.passoverFn(m, { ...data, guildRss: this.guildRss, rssNameList: valid })
    }
  }

  // Return a single index for non feed removal actions
  const index = parseInt(chosenOption, 10) - 1
  if (isNaN(index) || index + 1 > currentRSSList.length || index + 1 < 1) {
    throw new MenuOptionError()
  }

  // Data is pre-passed into a FeedSelector's fn, merged with the previous Menu's data
  return this.passoverFn(m, { ...data, guildRss: this.guildRss, rssName: currentRSSList[index].rssName })
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
   * @param {Boolean} [cmdInfo.multiSelect] Whether to allow multiple feeds to be selected
   * @param {Boolean} [cmdInfo.globalSelect] Whether to allow feeds from other channels to be selected
   * @param {String} [cmdInfo.prependDescription] Additional information in the description, before the FeedSelector's default instructions
   * @memberof FeedSelector
   */
  constructor (message, passoverFn, cmdInfo, guildRss) {
    super(message)
    if (!passoverFn) passoverFn = async (m, data) => data
    this.guildRss = guildRss
    this.passoverFn = passoverFn
    if (!this.guildRss || !this.guildRss.sources || Object.keys(this.guildRss.sources).length === 0) {
      this.text = Translator.translate('structs.FeedSelector.noFeeds', this.locale)
      return
    }
    if (guildRss) this.locale = guildRss.locale
    const { command, miscOption, multiSelect, prependDescription, globalSelect } = cmdInfo
    this.command = command
    this.miscOption = miscOption
    this.multiSelect = MULTI_SELECT.includes(command) || multiSelect
    this.globalSelect = GLOBAL_SELECT.includes(command) || globalSelect
    const translator = new Translator(this.locale)
    this.translate = translator.translate.bind(translator)

    const rssList = this.guildRss.sources
    this._currentRSSList = []

    const optionTexts = getOptionTexts(this.translate)

    for (var rssName in rssList) { // Generate the info for each feed as an object, and push into array to be used in pages that are sent
      const source = rssList[rssName]
      if (message.channel.id !== source.channel && !this.globalSelect) continue
      let o = { link: source.link, rssName: rssName, title: source.title }

      if (optionTexts[miscOption]) {
        const statusText = optionTexts[miscOption].status
        let decision = ''

        const globalSetting = config.feeds[miscOption]
        decision = globalSetting ? `${statusText} ${this.translate('generics.enabledUpper')}\n` : `${statusText} ${this.translate('generics.disabledUpper')}\n`
        const specificSetting = source[miscOption]
        decision = typeof specificSetting !== 'boolean' ? decision : specificSetting === true ? `${statusText} ${this.translate('generics.enabledUpper')}\n` : `${statusText} ${this.translate('generics.disabledUpper')}\n`

        o.miscOption = decision
      }
      if (this.globalSelect) o.channel = source.channel
      this._currentRSSList.push(o)
    }

    if (this._currentRSSList.length === 0) {
      this.text = Translator.translate('structs.FeedSelector.noFeedsInChannel', this.locale)
      return
    }
    let desc = ''
    desc += (this.globalSelect ? '' : `**${this.translate('generics.channelUpper')}:** #${message.channel.name}\n`) + `**${this.translate('structs.FeedSelector.action')}**: ${command === 'rssoptions' ? optionTexts[miscOption].toggle : this.translate(`commandDescriptions.${command}.action`)}\n\n${prependDescription ? `${prependDescription}\n\n` : ''}${this.translate('structs.FeedSelector.prompt')} ${this.multiSelect ? `${this.translate('structs.FeedSelector.multiSelect')} ` : ''}${this.translate('structs.FeedSelector.exitToCancel')}\u200b\n\u200b\n`
    this.setAuthor(this.translate('structs.FeedSelector.feedSelectionMenu'))
    this.setDescription(desc)

    this._currentRSSList.forEach(item => {
      const channel = item.channel ? message.client.channels.has(item.channel) ? `${this.translate('generics.channelUpper')}: #${message.client.channels.get(item.channel).name}\n` : undefined : undefined
      const link = item.link
      const title = item.title
      const status = item.status || ''

      // const miscOption = item.checkTitles || item.imagePreviews || item.imageLinksExistence || item.checkDates || item.formatTables || ''
      const miscOption = item.miscOption || ''
      this.addOption(`${title.length > 200 ? title.slice(0, 200) + ' ...' : title}`, `${channel || ''}${miscOption}${status}${this.translate('commands.rsslist.link')}: ${link.length > 500 ? this.translate('commands.rsslist.exceeds500Characters') : link}`)
    })

    this.fn = selectFeedFn.bind(this)
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
  async send (data) {
    const m = await this.channel.send(this.text, { embed: this.pages[0] })
    this._msgCleaner.add(m)
    if (this.pages.length > 1) {
      await m.react('◀')
      await m.react('▶')
      pageControls.add(m.id, this.pages)
    }

    if (!this.fn) return [] // This function is called *after* the feed is selected with the pre-made function selectFeedFn

    return new Promise((resolve, reject) => {
      const collector = this.channel.createMessageCollector(m => m.author.id === this.message.author.id, { time: 60000 })
      channelTracker.add(this.channel.id)

      collector.on('collect', async m => {
        this._msgCleaner.add(m)
        if (m.content.toLowerCase() === 'exit') {
          collector.stop(this.translate('structs.MenuUtils.closed'))
          return resolve(this._series ? [{ __end: true }, this._msgCleaner] : [])
        }

        try {
          const passover = await this.fn(m, data)
          collector.stop()
          resolve([ passover, this._msgCleaner ])
        } catch (err) {
          if (err instanceof MenuOptionError) {
            const message = err.message || this.translate('structs.errors.MenuOptionError.message')
            m.channel.send(message).then(m => this._msgCleaner.add(m)).catch(reject)
          } else {
            collector.stop()
            reject(err)
          }
        }
      })

      collector.on('end', (collected, reason) => {
        channelTracker.remove(this.channel.id)
        if (reason === 'user') return
        if (reason === 'time') this.channel.send(this.translate('structs.MenuUtils.closedInactivity')).catch(err => log.command.warning(`Unable to send expired menu message`, this.channel.guild, err))
        else this.channel.send(reason).then(m => m.delete(6000))
      })
    })
  }
}

module.exports = FeedSelector
