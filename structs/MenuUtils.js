const RichEmbed = require('discord.js').RichEmbed
const config = require('../config.json')
const channelTracker = require('../util/channelTracker.js')
const MessageCleaner = require('./MessageCleaner.js')
const pageControls = require('../util/pageControls.js')
const log = require('../util/logger.js')
const WRONG_INPUT = 'That is not a valid choice. Try again, or type `exit` to cancel.'

/**
 * A model that automatically handles pagination via reactions for multiple embeds and able to be used in series with data passed in a sequence.
 */
class Menu {
  /**
   * Creates an instance of Menu.
   * @param {Object} message A Discord.js Message
   * @param {Function} [fn] Function to execute within this Menu's collector
   * @param {Object} [settings] Initialize the embed or text
   * @param {String} [settings.text] Text of the message
   * @param {Object} [settings.embed] Object of the embed, defined by the Discord.js embed object
   * @param {number} [settings.maxPerPage] Max number of options per page before the next page is sutomatically created
   * @param {Boolean} [settings.numbered] Whether to number the options or not
   * @param {Object} [settings.splitOptions] Settings to split the message into multiple ones if it is too long
   * @memberof Menu
   */
  constructor (message, fn, settings) {
    this.maxPerPage = settings && typeof settings.maxPerPage === 'number' && settings.maxPerPage > 0 && settings.maxPerPage <= 10 ? settings.maxPerPage : 7
    this.message = message
    this.channel = message.channel
    this.hasAddReactionPermission = this.message.guild.me.permissionsIn(this.message.channel).has('ADD_REACTIONS')
    this.fn = fn
    this.pages = []
    this._pageNum = 0
    this._series = false
    this._numbered = settings && settings.numbered != null ? settings.numbered : true
    this._msgCleaner = new MessageCleaner(message)
    if (!settings) return
    if (settings.splitOptions) this.splitOptions = settings.splitOptions
    if (settings.text) this.text = settings.text
    if (!settings.embed) return
    const { embed } = settings
    this.pages[0] = new RichEmbed(embed).setColor(config.bot.menuColor)
    this._curPage = this.pages[this._pageNum]
    this.pages[0].fields.length = 0
  }

  /**
   * Creates an embed if it doesn't exist
   *
   * @memberof Menu
   */
  _embedExists () {
    if (this._pageNum === 0 && !this._curPage) {
      this.pages[0] = new RichEmbed().setColor(config.bot.menuColor)
      this._curPage = this.pages[0]
    }
  }

  /**
   * Add a new page (embed) to the list of pages (embeds)
   *
   * @returns {this}
   * @memberof Menu
   */
  addPage () {
    ++this._pageNum
    const newPage = new RichEmbed(this.pages[0])
    newPage.fields = []
    const missingPermText = !this.hasAddReactionPermission ? ` (WARNING: Missing "Add Reactions" permission in this channel. Because this menu has more than ${this.maxPerPage} options, it will not function properly without this permission. ` : ''
    this.pages[this._pageNum] = newPage
    for (var x = 0; x < this.pages.length; ++x) {
      const p = this.pages[x]
      p.setFooter((`Page ${x + 1}/${this.pages.length}`) + missingPermText)
    }
    this._curPage = this.pages[this._pageNum]
    return this
  }

  /**
   * Set the text message
   *
   * @param {String} txt Text message
   * @returns {this}
   * @memberof Menu
   */
  setText (txt) {
    this.text = txt
    return this
  }

  /**
   * Set the description for all the embeds
   *
   * @param {String} desc Description
   * @returns {this}
   * @memberof Menu
   */
  setDescription (desc) {
    this._embedExists()
    this.pages.forEach(embed => embed.setDescription(desc))
    return this
  }

  /**
   * Set the author for all the embeds
   *
   * @param {String} text Author text
   * @param {String} [url] Author URL
   * @param {String} [icon] Author icon URL
   * @returns {this}
   * @memberof Menu
   */
  setAuthor (text, url, icon) {
    this._embedExists()
    this.pages.forEach(embed => embed.setAuthor(text, url, icon))
    return this
  }

  /**
   * Set the title for all the embeds
   *
   * @param {String} text Title text
   * @returns {this}
   * @memberof Menu
   */
  setTitle (text) {
    this._embedExists()
    this.pages.forEach(embed => embed.setTitle(text))
    return this
  }

  /**
   * Set the footer for all the embeds
   *
   * @param {String} text Footer text
   * @param {String} [icon] Footer icon URL
   * @returns {this}
   * @memberof Menu
   */
  setFooter (text, icon) {
    this._embedExists()
    this.pages.forEach(embed => embed.setFooter(text, icon))
    return this
  }

  /**
   * Remove all embeds from this menu
   *
   * @memberof Menu
   */
  removeAllEmbeds () {
    this.pages.length = 0
    this._pageNum = 0
    this._curPage = 0
  }

  /**
   * Add an automaticaly numbered field to the current embed with automatic pagination
   *
   * @param {String} title Field title
   * @param {String} desc Field description
   * @param {Boolean} inline Whether to inline the field
   * @returns {this}
   * @memberof Menu
   */
  addOption (title, desc, inline) {
    this._embedExists()
    if (this._curPage && this._curPage.fields.length >= this.maxPerPage) this.addPage()
    if (!title && !desc) this._curPage.addBlankField(inline)
    else {
      if (title === undefined) throw new Error('Menu Title must be defined')
      if (desc === undefined) throw new Error('Menu Description must be defined')
      this._curPage.addField(`${this._numbered ? (this.pages.length - 1) * this.maxPerPage + (this._curPage.fields.length + 1) + ') ' : ''}${title}`, desc.length > 1024 ? desc.slice(0, 1000) + '...' : desc, inline)
    }

    return this
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
   * @memberof Menu
   */
  async send (data, callback) {
    try {
      let m
      if (Array.isArray(this.text)) {
        for (var ind = 0; ind < this.text.length; ++ind) {
          // Only send the embed on the final message if there are multiple messages. This emulates regular message splitting with multiple texts.
          m = await this.channel.send(this.text[ind], ind === this.text.length - 1 ? { embed: this.pages[0] } : undefined)
          this._msgCleaner.add(m)
        }
      } else {
        m = await this.channel.send(this.text, { embed: this.pages[0], split: this.splitOptions ? this.splitOptions : undefined })
        this._msgCleaner.add(m)
      }
      if (this.pages.length > 1) {
        await m.react('◀')
        await m.react('▶')
        pageControls.add(m.id, this.pages)
      }

      // If there is no function, then it's a visual, non-function Menu
      if (!this.fn) return callback()

      const collector = this.channel.createMessageCollector(m => m.author.id === this.message.author.id, { time: 90000 })
      // Add a channel tracker to prohibit any other commands while the Menu is in use
      channelTracker.add(this.channel.id)

      collector.on('collect', m => {
        this._msgCleaner.add(m)
        if (m.content.toLowerCase() === 'exit') {
          collector.stop('Menu closed.')
          // __end will cause the MenuSeries, if it exists, to skip its callback function and all further menus
          return this._series ? callback(null, { __end: true }, this._msgCleaner) : null
        }

        // Call the function defined in the constructor
        this.fn(m, data, (err, passover, endPrematurely) => {
          // SyntaxError allows input retries for this collector due to incorrect input
          if (err instanceof SyntaxError) return m.channel.send(err.message ? err.message : WRONG_INPUT, { split: true }).then(m => this._msgCleaner.add(m))
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

/**
 * Holds multiple Menus with their respective functions to be executed in sequence
 */
class MenuSeries {
  /**
   * Creates an instance of MenuSeries.
   * @param {Message} message A Discord.js Message
   * @param {Menu[]} menus Menus to be merged in order
   * @param {Object} data Data to pass over to the first Menu
   * @memberof MenuSeries
   */
  constructor (message, menus, data) {
    this._menus = []
    this._data = data
    this._mergedData = {}
    this._msgCleaner = new MessageCleaner(message)
    menus.forEach(item => {
      item._series = true
      this._menus.push(item)
    })
  }

  /**
   * Merge a MenuSeries to this MenuSeries by moving
   *
   * @param {MenuSeries} series - The MenuSeries to merge into this one
   * @param {Object} series._data Data to passover to the first Menu of the new series
   * @returns {this}
   * @memberof MenuSeries
   */
  merge (series) {
    if (!(series instanceof MenuSeries)) throw new TypeError('Not a MenuSeries')

    // Data to merge from the new MenuSeries constructor to the last function's passover data of this MenuSeries. Must be done before the series is merged.
    if (series._data) this._mergedData[this._menus.length] = [series._data]
    series._menus.forEach(item => {
      this._msgCleaner.merge(item._msgCleaner)
      this._menus.push(item)
    })

    return this
  }

  /**
   * Add a Menu to this MenuSeries
   *
   * @param {Menu} menu - The Menu to add to this MenuSeries
   * @param {Object} data - Data to pass over to the last function's passover data before the new addition
   * @returns {this}
   * @memberof MenuSeries
   */
  add (menu, data) {
    if (!(menu instanceof Menu)) throw new TypeError('Not a Menu')
    if (data) this._mergedData[this._menus.length] = [data]
    this._menus.push(menu)
    return this
  }

  /**
   * Start the MenuSeries with the first Menu
   *
   * @param {Function} callback Function to call when the MenuSeries has gone through all its Menus
   * @memberof MenuSeries
   */
  start (callback) {
    this._send(0, this._data, callback)
  }

  _end (err, data, callback) {
    this._msgCleaner.deleteAll()
    callback(err, data)
  }

  /**
   * Callback function for finishing a MenuSeries
   *
   * @callback finishCallback
   * @param {Error} err Any errors encountered during any Menus
   * @param {Object} data Data to pass over to the ending function of this Series
   */

  /**
   * Explicitly send a Menu
   *
   * @param {number} [index=0] Index of the Menu in this._menus
   * @param {Object} [data={}] Data to passover to the next Menu, or to callback
   * @param {finishCallback} callback Callback to the ending function of this Series
   * @memberof MenuSeries
   */
  _send (index = 0, data = {}, callback) {
    // Add any merged data from additionally added Menu's or merged Series
    const mergedData = this._mergedData[index]
    if (mergedData) {
      mergedData.forEach(item => {
        data = { ...data, ...item }
      })
    }

    const curMenu = this._menus[index]
    const next = data.next

    // Set the next Menu's visuals based on the previous Menu's requests in data.next
    if (next && next.text) curMenu.setText(next.text)
    if (next && next.embed === null) curMenu.removeAllEmbeds()
    if (next && next.embed) {
      const { title, author, description, options } = next.embed
      if (title) curMenu.setTitle(title)
      if (author) curMenu.setAuthor(author.text, author.icon, author.url)
      if (description) curMenu.setDescription(description)
      if (Array.isArray(options)) options.forEach(item => curMenu.addOption(item.title, item.description, item.inline))
    }

    curMenu.send(data, (err, passover = {}, msgCleaner, endPrematurely) => {
      const next = passover.next
      this._msgCleaner.merge(msgCleaner)

      // Check for any indicators to stop the MenuSeries
      if (passover.__end) return this._msgCleaner.deleteAll() // Do not execute the ending callback function and skip any further menus
      else if (endPrematurely === true) return this._end(null, passover, callback) // Execute the ending callback function and skip any further menus
      else if (err) return this._end(err, null, callback) // Execute the ending callback function with the err parameter and skip any further menus

      // Add any Menus requested to be added by the Menu that just finished
      if (next && next.menu) {
        if (next.menu instanceof Menu) this.add(next.menu)
        else if (Array.isArray(next.menu)) next.menu.forEach(item => this.add(item))
        delete next.menu
      }

      // Merge any MenuSeries requested to be added by the Menu that just finished
      if (next && next.series) {
        if (next.series instanceof MenuSeries) this.merge(next.series)
        else if (Array.isArray(next.series)) next.series.forEach(item => this.merge(item))
        delete next.series
      }

      if (!this._menus[++index]) return this._end(null, passover, callback)
      this._send(index, passover, callback)
    })
  }
}

exports.Menu = Menu
exports.MenuSeries = MenuSeries
exports.trimArray = arr => arr.map(item => item.trim()).filter((item, index, self) => item && index === self.indexOf(item))
