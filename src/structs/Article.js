const moment = require('moment-timezone')
const htmlConvert = require('html-to-text')
const htmlDecoder = require('html-to-text/lib/formatter.js').text
const FlattenedJSON = require('./FlattenedJSON.js')
const FilterResults = require('./FilterResults.js')
const Filter = require('./Filter.js')
const FilterRegex = require('./FilterRegex.js')
const getConfig = require('../config.js').get
const VALID_PH_IMGS = ['title', 'description', 'summary']
const VALID_PH_ANCHORS = ['title', 'description', 'summary']
const BASE_REGEX_PHS = ['title', 'author', 'summary', 'description', 'guid', 'date', 'link']

function dateHasNoTime (date) { // Determine if the time is T00:00:00.000Z
  const timeParts = [date.getUTCHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()]
  for (var x in timeParts) {
    if (timeParts[x] !== 0) return false
  }
  return true
}

function setCurrentTime (momentObj) {
  const now = new Date()
  return momentObj.hours(now.getHours()).minutes(now.getMinutes()).seconds(now.getSeconds()).millisecond(now.getMilliseconds())
}

// To avoid stack call exceeded
function checkObjType (item, results) {
  if (Object.prototype.toString.call(item) === '[object Object]') {
    return () => findImages(item, results)
  } else if (typeof item === 'string' && item.match(/\.(jpg|jpeg|png|gif|bmp|webp|php)$/i) && !results.includes(item) && results.length < 9) {
    if (item.startsWith('//')) item = 'http:' + item
    results.push(item.replace(/\s/g, '%20'))
  }
}

// Used to find images in any object values of the article
function findImages (obj, results) {
  for (var key in obj) {
    let value = checkObjType(obj[key], results)
    while (typeof value === 'function') {
      value = value()
    }
  }
}

function escapeRegExp (str) {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
}

function regexReplace (string, searchOptions, replacement, replacementDirect) {
  if (typeof searchOptions !== 'object') throw new TypeError(`Expected RegexOp search key to have an object value, found ${typeof searchOptions} instead`)
  if (replacementDirect) return string.replace(new RegExp(searchOptions.regex, searchOptions.flags), replacementDirect) // Allow direct input into the search function, and ignore "match" and "group" in the regexOp.search
  const flags = !searchOptions.flags ? 'g' : searchOptions.flags.includes('g') ? searchOptions.flags : searchOptions.flags + 'g' // Global flag must be included to prevent infinite loop during .exec
  const matchIndex = searchOptions.match !== undefined ? parseInt(searchOptions.match, 10) : undefined
  const groupNum = searchOptions.group !== undefined ? parseInt(searchOptions.group, 10) : undefined
  const regExp = new RegExp(searchOptions.regex, flags)
  const matches = []
  let match
  do { // Find everything that matches the search regex query and push it to matches.
    match = regExp.exec(string)
    if (match) matches.push(match)
  } while (match)
  if (matches.length === 0) return string
  else {
    const mi = matches[matchIndex || 0]
    if (!mi) return string
    else match = mi[groupNum || 0]
  }

  if (replacement !== undefined) {
    if (matchIndex === undefined && groupNum === undefined) { // If no match or group is defined, replace every full match of the search in the original string
      for (var x in matches) {
        const exp = new RegExp(escapeRegExp(matches[x][0]), flags)
        string = string.replace(exp, replacement)
      }
    } else if (matchIndex && groupNum === undefined) { // If no group number is defined, use the full match of this particular match number in the original string
      const exp = new RegExp(escapeRegExp(matches[matchIndex][0]), flags)
      string = string.replace(exp, replacement)
    } else if (matchIndex === undefined && groupNum) {
      const exp = new RegExp(escapeRegExp(matches[0][groupNum]), flags)
      string = string.replace(exp, replacement)
    } else {
      const exp = new RegExp(escapeRegExp(matches[matchIndex][groupNum]), flags)
      string = string.replace(exp, replacement)
    }
  } else string = match

  return string
}

function evalRegexConfig (feed, text, placeholderName) {
  const customPlaceholders = {}

  if (Array.isArray(feed.regexOps[placeholderName])) { // Eval regex if specified
    if (Array.isArray(feed.regexOps.disabled) && feed.regexOps.disabled.length > 0) { // .disabled can be an array of disabled placeholders, or just a boolean to disable everything
      for (var y in feed.regexOps.disabled) { // Looping through strings of placeholders
        if (feed.regexOps.disabled[y] === placeholderName) return null
      }
    }

    const phRegexOps = feed.regexOps[placeholderName]
    for (var regexOpIndex in phRegexOps) { // Looping through each regexOp for a placeholder
      const regexOp = phRegexOps[regexOpIndex]
      if (regexOp.disabled === true || typeof regexOp.name !== 'string') continue
      if (!customPlaceholders[regexOp.name]) customPlaceholders[regexOp.name] = text // Initialize with a value if it doesn't exist
      const clone = Object.assign({}, customPlaceholders)
      const replacement = regexReplace(clone[regexOp.name], regexOp.search, regexOp.replacement, regexOp.replacementDirect)
      customPlaceholders[regexOp.name] = replacement === clone[regexOp.name] && regexOp.emptyOnNoMatch === true ? '\u200b' : replacement
    }
  } else return null
  return customPlaceholders
}

function cleanup (feed, text, imgSrcs, anchorLinks) {
  if (!text) return ''
  const config = getConfig()
  text = htmlDecoder({ data: text }, {}).replace(/\*/gi, '')
    .replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, '**$2**') // Bolded markdown
    .replace(/<(em|i)>(.*?)<(\/(em|i))>/gi, '*$2*') // Italicized markdown
    .replace(/<(u)>(.*?)<(\/(u))>/gi, '__$2__') // Underlined markdown

  text = htmlConvert.fromString(text, {
    tables: (feed.formatTables !== undefined && typeof feed.formatTables === 'boolean' ? feed.formatTables : config.feeds.formatTables) === true ? true : [],
    wordwrap: null,
    ignoreHref: true,
    noLinkBrackets: true,
    format: {
      image: node => {
        const isStr = typeof node.attribs.src === 'string'
        let link = isStr ? node.attribs.src.trim().replace(/\s/g, '%20') : node.attribs.src
        if (isStr && link.startsWith('//')) link = 'http:' + link
        else if (isStr && !link.startsWith('http://') && !link.startsWith('https://')) link = 'http://' + link

        if (Array.isArray(imgSrcs) && imgSrcs.length < 9 && isStr && link) {
          imgSrcs.push(link)
        }

        let exist = true
        const globalExistOption = config.feeds.imgLinksExistence
        exist = globalExistOption
        const specificExistOption = feed.imgLinksExistence
        exist = typeof specificExistOption !== 'boolean' ? exist : specificExistOption
        if (!exist) return ''

        let image = ''
        const globalPreviewOption = config.feeds.imgPreviews
        image = globalPreviewOption ? link : `<${link}>`
        const specificPreviewOption = feed.imgPreviews
        image = typeof specificPreviewOption !== 'boolean' ? image : specificPreviewOption === true ? link : `<${link}>`

        return image
      },
      anchor: (node, fn, options) => {
        const orig = fn(node.children, options)
        if (!Array.isArray(anchorLinks)) return orig
        const href = node.attribs.href ? node.attribs.href.trim() : ''
        if (anchorLinks.length < 5 && href) anchorLinks.push(href)
        return orig
      },
      blockquote: (node, fn, options) => {
        const orig = fn(node.children, options).trim()
        return '> ' + orig.replace(/(?:\n)/g, '\n> ') + '\n'
      }
    }
  })

  text = text.replace(/\n\s*\n\s*\n/g, '\n\n') // Replace triple line breaks with double
    .replace(/@/g, '@' + String.fromCharCode(8203)) // Sanitize mentions with zero-width character "\u200b", does not affect subscribed roles or modify anything outside the scope of sanitizing Discord mentions in the raw RSS feed content
  const arr = text.split('\n')
  for (var q = 0; q < arr.length; ++q) arr[q] = arr[q].replace(/\s+$/, '') // Remove trailing spaces
  return arr.join('\n').trim()
}

module.exports = class Article {
  constructor (raw, feedData) {
    const feed = feedData.feed
    const profile = feedData.profile || {}
    this.id = raw._id || null
    this.feed = feed
    this.profile = profile
    this.raw = raw
    this.reddit = raw.meta.link && raw.meta.link.includes('www.reddit.com')
    this.youtube = !!(raw.guid && raw.guid.startsWith('yt:video') && raw['media:group'] && raw['media:group']['media:description'] && raw['media:group']['media:description']['#'])
    this.enabledRegex = typeof feed.regexOps === 'object' && feed.regexOps.disabled !== true
    this.placeholdersForRegex = BASE_REGEX_PHS.slice()
    this.privatePlaceholders = ['id', 'fullDescription', 'fullSummary', 'fullTitle', 'fullDate']
    this.placeholders = []
    this.meta = raw.meta
    this.guid = raw.guid
    // Author
    this.author = raw.author ? cleanup(feed, raw.author) : ''
    if (this.author) this.placeholders.push('author')

    // Link
    this.link = raw.link ? raw.link.split(' ')[0].trim() : '' // Sometimes HTML is appended at the end of links for some reason
    if (this.link) this.placeholders.push('link')
    if (this.reddit && this.link.startsWith('/r/')) this.link = 'https://www.reddit.com' + this.link

    // Title
    this.titleImages = []
    this.titleAnchors = []
    this.fullTitle = cleanup(feed, raw.title, this.titleImages, this.titleAnchors)
    this.title = this.fullTitle.length > 150 ? `${this.fullTitle.slice(0, 150)}...` : this.fullTitle
    if (this.title) this.placeholders.push('title')
    for (var titleImgNum in this.titleImages) {
      const term = `title:image${parseInt(titleImgNum, 10) + 1}`
      this.placeholders.push(term)
      this[term] = this.titleImages[titleImgNum]
      if (this.enabledRegex) this.placeholdersForRegex.push(term)
    }
    for (var titleAnchorNum in this.titleAnchors) {
      const term = `title:anchor${parseInt(titleAnchorNum, 10) + 1}`
      this.placeholders.push(term)
      this[term] = this.titleAnchors[titleAnchorNum]
      if (this.enabledRegex) this.placeholdersForRegex.push(term)
    }

    // guid - Raw exposure, no cleanup. Not meant for use by most feeds.
    this.guid = raw.guid ? raw.guid : ''
    if (this.guid) this.placeholders.push('guid')

    // Date
    this.fullDate = raw.pubdate
    this.date = this.formatDate(this.fullDate, this.profile.timezone)
    if (this.date) this.placeholders.push('date')

    // Description and reddit-specific placeholders
    this.descriptionImages = []
    this.descriptionAnchors = []
    this.fullDescription = this.youtube ? raw['media:group']['media:description']['#'] : cleanup(feed, raw.description, this.descriptionImages, this.descriptionAnchors) // Account for youtube's description
    this.description = this.fullDescription
    this.description = this.description.length > 800 ? `${this.description.slice(0, 790)}...` : this.description
    if (this.description) this.placeholders.push('description')
    for (var desImgNum in this.descriptionImages) {
      const term = `description:image${parseInt(desImgNum, 10) + 1}`
      this.placeholders.push(term)
      this[term] = this.descriptionImages[desImgNum]
      if (this.enabledRegex) this.placeholdersForRegex.push(term)
    }
    for (var desAnchorNum in this.descriptionAnchors) {
      const term = `description:anchor${parseInt(desAnchorNum, 10) + 1}`
      this.placeholders.push(term)
      this[term] = this.descriptionAnchors[desAnchorNum]
      if (this.enabledRegex) this.placeholdersForRegex.push(term)
    }

    if (this.reddit) {
      // Truncate the useless end of reddit description after anchors are removed
      this.fullDescription = this.fullDescription.replace('\n[link] [comments]', '')
      this.description = this.description.replace('\n[link] [comments]', '')
    }

    // Summary
    this.summaryImages = []
    this.summaryAnchors = []
    this.fullSummary = cleanup(feed, raw.summary, this.summaryImages, this.summaryAnchors)
    this.summary = this.fullSummary.length > 800 ? `${this.fullSummary.slice(0, 790)}...` : this.fullSummary
    if (this.summary && raw.summary !== raw.description) this.placeholders.push('summary')
    for (var sumImgNum in this.summaryImages) {
      const term = `summary:image${+sumImgNum + 1}`
      if (this.summaryImages[sumImgNum] !== this.descriptionImages[sumImgNum]) {
        this.placeholders.push(term)
        this[term] = this.summaryImages[sumImgNum]
      }
      if (this.enabledRegex) this.placeholdersForRegex.push(term)
    }
    for (var sumAnchorNum in this.summaryAnchors) {
      const term = `summary:anchor${+sumAnchorNum + 1}`
      if (this.summaryAnchors[sumImgNum] !== this.descriptionAnchors[sumImgNum]) {
        this.placeholders.push(term)
        this[term] = this.summaryAnchors[sumAnchorNum]
      }
      if (this.enabledRegex) this.placeholdersForRegex.push(term)
    }

    // Image links
    const imageLinks = []
    findImages(raw, imageLinks)
    this.images = (imageLinks.length === 0) ? undefined : imageLinks
    for (var imageNum in imageLinks) {
      const term = `image${parseInt(imageNum, 10) + 1}`
      this.placeholders.push(term)
      this[term] = imageLinks[imageNum]
      if (this.enabledRegex) this.placeholdersForRegex.push(term)
    }

    // Categories/Tags
    if (raw.categories) {
      let categoryList = ''
      const cats = raw.categories
      for (var category in cats) {
        if (typeof cats[category] !== 'string') continue
        categoryList += cats[category].trim()
        if (parseInt(category, 10) !== cats.length - 1) categoryList += '\n'
      }
      this.tags = cleanup(feed, categoryList)
      if (this.tags) this.placeholders.push('tags')
    }

    // Regex-defined custom placeholders
    if (this.enabledRegex) {
      this.regexPlaceholders = {} // Each key is a validRegexPlaceholder, and their values are an object of named placeholders with the modified content
      for (var b in this.placeholdersForRegex) {
        const placeholderName = this.placeholdersForRegex[b]
        const regexResults = evalRegexConfig(feed, this[placeholderName], placeholderName)
        this.regexPlaceholders[placeholderName] = regexResults
      }
    }

    // Finally subscriptions - this MUST be done last after all variables have been defined for filter testing
    this.subscribers = ''

    // Get filtered subscriptions
    const subscribers = feedData.subscribers
    if (subscribers) {
      for (const subscriber of subscribers) {
        const type = subscriber.type
        if (type !== 'role' && type !== 'user') {
          continue
        }
        const mentionText = type === 'role' ? `<@&${subscriber.id}> ` : `<@${subscriber.id}> `
        if (subscriber.filters && this.testFilters(subscriber.filters).passed) {
          this.subscribers += mentionText
        } else if (!subscriber.filters || Object.keys(subscriber.filters).length === 0) {
          this.subscribers += mentionText
        }
      }
    }

    if (this.subscribers) {
      this.placeholders.push('subscriptions')
      this.placeholders.push('subscribers')
    }
  }

  // List all {imageX} to string
  listImages () {
    const images = this.images
    let imageList = ''
    for (var image in images) {
      imageList += `[Image${parseInt(image, 10) + 1} URL]: {image${parseInt(image, 10) + 1}}\n${images[image]}`
      if (parseInt(image, 10) !== images.length - 1) imageList += '\n'
    }
    return imageList
  }

  // List all {placeholder:imageX} to string
  listPlaceholderImages () {
    const listedImages = []
    let list = ''
    for (var k in VALID_PH_IMGS) {
      const placeholderImgs = this[VALID_PH_IMGS[k] + 'Images']
      for (var l in placeholderImgs) {
        if (listedImages.includes(placeholderImgs[l])) continue
        listedImages.push(placeholderImgs[l])
        const placeholder = VALID_PH_IMGS[k].slice(0, 1).toUpperCase() + VALID_PH_IMGS[k].substr(1, VALID_PH_IMGS[k].length)
        const imgNum = parseInt(l, 10) + 1
        list += `\n[${placeholder} Image${imgNum}]: {${VALID_PH_IMGS[k]}:image${imgNum}}\n${placeholderImgs[l]}`
      }
    }

    return list.trim()
  }

  // List all {placeholder:imageX} to string
  listPlaceholderAnchors () {
    const listedAnchors = []
    let list = ''
    for (var k in VALID_PH_ANCHORS) {
      const placeholderAnchors = this[VALID_PH_ANCHORS[k] + 'Anchors']
      for (var l in placeholderAnchors) {
        if (listedAnchors.includes(placeholderAnchors[l])) continue
        listedAnchors.push(placeholderAnchors[l])
        const placeholder = VALID_PH_ANCHORS[k].slice(0, 1).toUpperCase() + VALID_PH_ANCHORS[k].substr(1, VALID_PH_ANCHORS[k].length)
        const anchorNum = parseInt(l, 10) + 1
        list += `\n[${placeholder} Anchor${anchorNum}]: {${VALID_PH_ANCHORS[k]}:anchor${anchorNum}}\n${placeholderAnchors[l]}`
      }
    }

    return list.trim()
  }

  resolvePlaceholderImg (input) {
    const inputArr = input.split('||')
    let img = ''
    for (var x = inputArr.length - 1; x >= 0; x--) {
      const term = inputArr[x]
      if (term.startsWith('http')) {
        img = term
        continue
      }
      const arr = term.split(':')
      if (term.startsWith('{image')) {
        img = this.convertImgs(term)
        continue
      } else if (arr.length === 1 || arr[1].search(/image[1-9]/) === -1) continue
      const placeholder = arr[0].replace(/{|}/, '')
      const placeholderImgs = this[placeholder + 'Images']
      if (!VALID_PH_IMGS.includes(placeholder) || !placeholderImgs || placeholderImgs.length < 1) continue

      const imgNum = parseInt(arr[1].substr(arr[1].search(/[1-9]/), 1), 10) - 1
      if (isNaN(imgNum) || imgNum > 4 || imgNum < 0) continue
      img = placeholderImgs[imgNum]
    }
    return img
  }

  // {imageX} and {placeholder:imageX}
  convertImgs (content) {
    const imgDictionary = {}
    const imgLocs = content.match(/{image[1-9](\|\|(.+))*}/g)
    const phImageLocs = content.match(/({(description|title|summary):image[1-9](\|\|(.+))*})/gi)
    if (imgLocs) {
      for (var loc in imgLocs) {
        const term = imgLocs[loc]
        const termList = term.split('||')
        if (termList.length === 1) {
          const imgNum = parseInt(term[term.search(/[1-9]/)], 10)
          if (this.images && this.images[imgNum - 1]) imgDictionary[term] = this.images[imgNum - 1] // key is {imageX}, value is article image URL
          else imgDictionary[term] = ''
        } else {
          let decidedImage = ''
          for (var p = termList.length - 1; p >= 0; p--) { // Work though fallback images backwards - not very efficient but it works
            const subTerm = p === 0 ? `${termList[p]}}` : p === termList.length - 1 ? `{${termList[p]}` : `{${termList[p]}}` // Format for use in convertImgs
            const subImg = this.convertImgs(subTerm)
            if (subImg) decidedImage = subImg
          }
          imgDictionary[term] = decidedImage
        }
      }
      for (var imgKeyword in imgDictionary) {
        content = content.replace(new RegExp(escapeRegExp(imgKeyword), 'g'), imgDictionary[imgKeyword])
      }
    } else if (phImageLocs) {
      for (var h in phImageLocs) {
        content = this.resolvePlaceholderImg(phImageLocs[h]) ? content.replace(phImageLocs[h], this.resolvePlaceholderImg(phImageLocs[h])) : content.replace(phImageLocs[h], '')
      }
    }
    return content
  }

  resolvePlaceholderAnchor (input) {
    const arr = input.split(':')
    if (arr.length === 1 || arr[1].search(/anchor[1-5]/) === -1) return ''
    const placeholder = arr[0].replace(/{|}/, '')
    const placeholderAnchors = this[placeholder + 'Anchors']
    if (!VALID_PH_ANCHORS.includes(placeholder) || !placeholderAnchors || placeholderAnchors.length < 1) return ''
    const num = parseInt(arr[1].substr(arr[1].search(/[1-5]/), 1), 10) - 1
    if (isNaN(num) || num > 4 || num < 0) return ''
    return placeholderAnchors[num]
  }

  convertAnchors (content) {
    const phAnchorLocs = content.match(/({(description|title|summary):anchor[1-5](\|\|(.+))*})/gi)
    if (!phAnchorLocs) return content
    for (var h in phAnchorLocs) {
      content = this.resolvePlaceholderAnchor(phAnchorLocs[h]) ? content.replace(phAnchorLocs[h], this.resolvePlaceholderAnchor(phAnchorLocs[h])) : content.replace(phAnchorLocs[h], '')
    }
    return content
  }

  convertRawPlaceholders (content) {
    let result
    const matches = {}
    const config = getConfig()
    const regex = new RegExp('{raw:([^{}]+)}', 'g')
    do {
      result = regex.exec(content)
      if (!result) continue
      if (!this.flattenedJSON) this.flattenedJSON = new FlattenedJSON(this.raw, this.feed)
      const fullMatch = result[0]
      const matchName = result[1]
      matches[fullMatch] = this.flattenedJSON.results[matchName] || ''

      // Format the date if it is one
      if (Object.prototype.toString.call(matches[fullMatch]) === '[object Date]') {
        const guildTimezone = this.profile.timezone
        const timezone = guildTimezone && moment.tz.zone(guildTimezone) ? guildTimezone : config.feeds.timezone
        const dateFormat = this.profile.dateFormat ? this.profile.dateFormat : config.feeds.dateFormat
        const localMoment = moment(matches[fullMatch])
        if (this.profile.dateLanguage) localMoment.locale(this.profile.dateLanguage)
        const useTimeFallback = config.feeds.timeFallback === true && matches[fullMatch].toString() !== 'Invalid Date' && dateHasNoTime(matches[fullMatch])
        matches[fullMatch] = useTimeFallback ? setCurrentTime(localMoment).tz(timezone).format(dateFormat) : localMoment.tz(timezone).format(dateFormat)
      }
    } while (result !== null)
    for (var phName in matches) {
      content = content.replace(new RegExp(escapeRegExp(phName), 'g'), matches[phName])
    }
    return content
  }

  getRawPlaceholders () {
    if (!this.flattenedJSON) this.flattenedJSON = new FlattenedJSON(this.raw, this.feed)
    return this.flattenedJSON.results
  }

  getRawPlaceholderContent (phName) {
    if (!phName.startsWith('raw:')) return ''
    if (this.flattenedJSON) return this.flattenedJSON.results[phName.replace(/raw:/, '')] || ''
    else {
      this.flattenedJSON = new FlattenedJSON(this.raw, this.feed)
      return this.flattenedJSON.results[phName.replace(/raw:/, '')] || ''
    }
  }

  formatDate (date, tz) {
    const config = getConfig()
    if (date && date.toString() !== 'Invalid Date') {
      const timezone = tz && moment.tz.zone(tz) ? tz : config.feeds.timezone
      const dateFormat = this.profile.dateFormat ? this.profile.dateFormat : config.feeds.dateFormat

      const useDateFallback = config.feeds.dateFallback === true && (!date || date.toString() === 'Invalid Date')
      const useTimeFallback = config.feeds.timeFallback === true && date.toString() !== 'Invalid Date' && dateHasNoTime(date)
      const useDate = useDateFallback ? new Date() : date
      const localMoment = moment(useDate)
      if (this.profile.dateLanguage) {
        localMoment.locale(this.profile.dateLanguage)
      }
      const vanityDate = useTimeFallback ? setCurrentTime(localMoment).tz(timezone).format(dateFormat) : localMoment.tz(timezone).format(dateFormat)
      return vanityDate === 'Invalid Date' ? '' : vanityDate
    }
    return ''
  }

  createTestText () {
    const filterResults = this.testFilters(this.feed.filters)
    let testDetails = ''
    const footer = `\nBelow is the configured message to be sent for this feed in the channel <#${this.feed.channel}>:\n\n--`
    testDetails += '```Markdown\n# BEGIN TEST DETAILS #``````Markdown'

    if (this.title) {
      testDetails += `\n\n[Title]: {title}\n${this.title}`
    }

    // Do not add summary if summary === description
    if (this.summary && this.summary !== this.description) {
      let testSummary
      if (this.description && this.description.length > 500) {
        // If description is long, truncate summary.
        testSummary = (this.summary.length > 500) ? `${this.summary.slice(0, 490)} [...]\n\n**(Truncated summary for shorter rsstest)**` : this.summary
      } else {
        testSummary = this.summary
      }
      testDetails += `\n\n[Summary]: {summary}\n${testSummary}`
    }

    if (this.description) {
      let testDescrip
      if (this.summary && this.summary.length > 500) {
        // If summary is long, truncate description.
        testDescrip = (this.description.length > 500) ? `${this.description.slice(0, 490)} [...]\n\n**(Truncated description for shorter rsstest)**` : this.description
      } else {
        testDescrip = this.description
      }
      testDetails += `\n\n[Description]: {description}\n${testDescrip}`
    }

    if (this.date) testDetails += `\n\n[Published Date]: {date}\n${this.date}`
    if (this.author) testDetails += `\n\n[Author]: {author}\n${this.author}`
    if (this.link) testDetails += `\n\n[Link]: {link}\n${this.link}`
    if (this.subscribers) testDetails += `\n\n[Subscribers]: {subscribers}\n${this.subscribers.split(' ').length - 1} subscriber(s)`
    if (this.images) testDetails += `\n\n${this.listImages()}`
    const placeholderImgs = this.listPlaceholderImages()
    if (placeholderImgs) testDetails += `\n\n${placeholderImgs}`
    const placeholderAnchors = this.listPlaceholderAnchors()
    if (placeholderAnchors) testDetails += `\n\n${placeholderAnchors}`
    if (this.tags) testDetails += `\n\n[Tags]: {tags}\n${this.tags}`
    if (this.feed.filters) {
      testDetails += `\n\n[Passed Filters?]: ${filterResults.passed ? 'Yes' : 'No'}${filterResults.passed ? filterResults.listMatches(false) + filterResults.listMatches(true) : filterResults.listMatches(true) + filterResults.listMatches(false)}`
    }
    testDetails += '```' + footer

    return testDetails
  }

  /**
   * @param {string[]} userFilters
   * @param {string} reference
   */
  testArrayFilters (userFilters, reference) {
    // Deal with inverted first
    const filters = userFilters.map(word => new Filter(word))
    const invertedFilters = filters.filter(filter => filter.inverted)
    const regularFilters = filters.filter(filter => !filter.inverted)
    const blocked = invertedFilters.find(filter => !filter.passes(reference))
    const returnData = {
      inverted: invertedFilters.map(f => f.content),
      regular: regularFilters.map(f => f.content)
    }
    if (blocked) {
      return {
        ...returnData,
        passed: false
      }
    }

    if (regularFilters.length === 0) {
      return {
        ...returnData,
        passed: true
      }
    }
    const passed = !!regularFilters.find(filter => filter.passes(reference))
    return {
      ...returnData,
      passed
    }
  }

  /**
   * @param {string} userFilter
   * @param {string} reference
   */
  testRegexFilter (userFilter, reference) {
    const filter = new FilterRegex(userFilter)
    const filterPassed = filter.passes(reference)
    if (filterPassed) {
      return {
        inverted: [],
        regular: [userFilter],
        passed: true
      }
    } else {
      return {
        inverted: [userFilter],
        regular: [],
        passed: false
      }
    }
  }

  getFilterReference (type) {
    const referenceOverrides = {
      description: this.fullDescription,
      summary: this.fullSummary,
      title: this.fullTitle
    }
    if (type.startsWith('raw:')) {
      return this.getRawPlaceholderContent(type)
    } else {
      return referenceOverrides[type.replace('other:', '')] || this[type.replace('other:', '')]
    }
  }

  testFilters (filters) {
    const filterResults = new FilterResults()
    let passed = Object.keys(filters).every(type => !!this.getFilterReference(type))
    filterResults.passed = passed
    // If not every key in filters exists on the articles, auto-block it
    if (!passed) {
      return filterResults
    }
    for (const filterTypeName in filters) {
      const userFilters = filters[filterTypeName]
      const reference = this.getFilterReference(filterTypeName)
      if (!reference) {
        continue
      }
      let invertedFilters = []
      let regularFilters = []

      // Filters can either be an array of words or a string (regex)
      let results
      if (Array.isArray(userFilters)) {
        results = this.testArrayFilters(userFilters, reference)
      } else {
        results = this.testRegexFilter(userFilters, reference)
      }
      passed = results.passed && passed
      invertedFilters = invertedFilters.concat(results.inverted)
      regularFilters = regularFilters.concat(results.regular)
      if (regularFilters.length > 0) {
        filterResults.add(filterTypeName, regularFilters, false)
      }
      if (invertedFilters.length > 0) {
        filterResults.add(filterTypeName, invertedFilters, true)
      }
    }
    filterResults.passed = passed
    return filterResults
  }

  // replace simple keywords
  convertKeywords (word = '', ignoreCharLimits) {
    if (word.length === 0) return word
    let content = word.replace(/{title}/g, ignoreCharLimits ? this.fullTitle : this.title)
      .replace(/{author}/g, this.author)
      .replace(/{summary}/g, ignoreCharLimits ? this.fullSummary : this.summary)
      .replace(/({subscriptions})|({subscribers})/g, this.subscribers)
      .replace(/{link}/g, this.link)
      .replace(/{description}/g, ignoreCharLimits ? this.fullDescription : this.description)
      .replace(/{tags}/g, this.tags)
      .replace(/{guid}/g, this.guid)

    const dateRegex = new RegExp('{date(:[a-zA-Z_/]*)?}')

    let result = dateRegex.exec(content)
    while (result !== null) {
      const zone = result[1] ? result[1].slice(1, result[1].length) : undefined // timezone within placeholder, e.g. {date:UTC}
      const fullLength = result[0].length // full match
      let convertedDate = ''
      if (zone === undefined) {
        // no custom timezone was defined after date within the placeholder
        convertedDate = this.date
      } else if (moment.tz.zone(zone)) {
        convertedDate = this.formatDate(this.fullDate, zone)
      }

      content = content.substring(0, result.index) + convertedDate + content.substring(result.index + fullLength, content.length)
      result = dateRegex.exec(content)
    }

    const regexPlaceholders = this.regexPlaceholders
    for (var placeholder in regexPlaceholders) {
      for (var customName in regexPlaceholders[placeholder]) {
        const replacementQuery = new RegExp(`{${placeholder}:${escapeRegExp(customName)}}`, 'g')
        const replacementContent = regexPlaceholders[placeholder][customName]
        content = content.replace(replacementQuery, replacementContent)
      }
    }

    return this.convertRawPlaceholders(this.convertAnchors(this.convertImgs(content)))
  }

  toJSON () {
    const data = {}
    // Regular
    for (const placeholder of this.placeholders) {
      data[placeholder] = this[placeholder]
    }

    // Private
    for (const placeholder of this.privatePlaceholders) {
      data[`_${placeholder}`] = this[placeholder]
    }

    // Regex
    for (const placeholder in this.regexPlaceholders) {
      const value = this.regexPlaceholders[placeholder]
      for (const customName in value) {
        data[`regex:${placeholder}:${customName}`] = value[customName]
      }
    }

    // Raw
    const rawPlaceholders = this.getRawPlaceholders()
    for (const rawPlaceholder in rawPlaceholders) {
      data[`raw:${rawPlaceholder}`] = rawPlaceholders[rawPlaceholder]
    }

    return data
  }
}
