const config = require('../config.json')
const moment = require('moment-timezone')
const htmlConvert = require('html-to-text')
const defaultConfigs = require('../util/configCheck.js').defaultConfigs
const log = require('../util/logger.js')
const VALID_PH_IMGS = ['title', 'description', 'summary']
const BASE_REGEX_PHS = ['title', 'author', 'summary', 'description', 'guid', 'date']

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
  } else if (typeof item === 'string' && item.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && !results.includes(item) && results.length < 9) {
    if (item.startsWith('//')) item = 'http:' + item
    results.push(item)
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

function regexReplace (string, searchOptions, replacement) {
  if (typeof searchOptions !== 'object') throw new TypeError(`Expected RegexOp search key to have an object value, found ${typeof searchOptions} instead`)
  const flags = !searchOptions.flags ? 'g' : searchOptions.flags.includes('g') ? searchOptions.flags : searchOptions.flags + 'g' // Global flag must be included to prevent infinite loop during .exec
  try {
    const matchIndex = searchOptions.match !== undefined ? parseInt(searchOptions.match, 10) : undefined
    const groupNum = searchOptions.group !== undefined ? parseInt(searchOptions.group, 10) : undefined
    const regExp = new RegExp(searchOptions.regex, flags)
    const matches = []
    let match
    do { // Find everything that matches the search regex query and push it to matches.
      match = regExp.exec(string)
      if (match) matches.push(match)
    } while (match)
    match = matches[matchIndex || 0][groupNum || 0]

    if (replacement !== undefined) {
      if (matchIndex === undefined && groupNum === undefined) { // If no match or group is defined, replace every full match of the search in the original string
        for (var x in matches) {
          const exp = new RegExp(escapeRegExp(matches[x][0]), flags)
          string = string.replace(exp, replacement)
        }
      } else if (matchIndex && groupNum === undefined) { // If no group number is defined, use the full match of this particular match number in the original string
        const exp = new RegExp(escapeRegExp(matches[matchIndex][0]), flags)
        string = string.replace(exp, replacement)
      } else {
        const exp = new RegExp(escapeRegExp(matches[matchIndex][groupNum]), flags)
        string = string.replace(exp, replacement)
      }
    } else string = match

    return string
  } catch (e) {
    return e
  }
}

function evalRegexConfig (source, text, placeholderName) {
  const customPlaceholders = {}

  if (Array.isArray(source.regexOps[placeholderName])) { // Eval regex if specified
    if (Array.isArray(source.regexOps.disabled) && source.regexOps.disabled.length > 0) { // .disabled can be an array of disabled placeholders, or just a boolean to disable everything
      for (var y in source.regexOps.disabled) { // Looping through strings of placeholders
        if (source.regexOps.disabled[y] === placeholderName) return null // text
      }
    }

    const phRegexOps = source.regexOps[placeholderName]
    for (var regexOpIndex in phRegexOps) { // Looping through each regexOp for a placeholder
      const regexOp = phRegexOps[regexOpIndex]
      if (regexOp.disabled === true || typeof regexOp.name !== 'string') continue

      if (!customPlaceholders[regexOp.name]) customPlaceholders[regexOp.name] = text // Initialize with a value if it doesn't exist

      const clone = Object.assign({}, customPlaceholders)

      const modified = regexReplace(clone[regexOp.name], regexOp.search, regexOp.replacement)
      if (typeof modified !== 'string') {
        if (config.feeds.showRegexErrs !== false) log.general.error(`Evaluation of regex for article ${source.link}`, modified)
      } else customPlaceholders[regexOp.name] = modified // newText = modified
    }
  } else return null
  return customPlaceholders
}

function cleanup (source, text, imgSrcs) {
  if (!text) return ''

  text = text.replace(/\*/gi, '')
    .replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, '**$2**') // Bolded markdown
    .replace(/<(em|i)>(.*?)<(\/(em|i))>/gi, '*$2*') // Italicized markdown
    .replace(/<(u)>(.*?)<(\/(u))>/gi, '__$2__') // Underlined markdown

  text = htmlConvert.fromString(text, {
    tables: (source.formatTables !== undefined && typeof source.formatTables === 'boolean' ? source.formatTables : config.feeds.formatTables) === true ? true : [],
    wordwrap: null,
    ignoreHref: true,
    noLinkBrackets: true,
    format: {
      image: node => {
        const isStr = typeof node.attribs.src === 'string'
        let link = isStr ? node.attribs.src.trim() : node.attribs.src
        if (isStr && link.startsWith('//')) link = 'http:' + link
        else if (isStr && !link.startsWith('http://') && !link.startsWith('https://')) link = 'http://' + link

        if (Array.isArray(imgSrcs) && imgSrcs.length < 5 && isStr && link) imgSrcs.push(link)

        let exist = true
        const globalExistOption = config.feeds.imgLinksExistence != null ? config.feeds.imgLinksExistence : defaultConfigs.feeds.imgLinksExistence.default // Always a boolean via startup checks
        exist = globalExistOption
        const specificExistOption = source.imgLinksExistence
        exist = typeof specificExistOption !== 'boolean' ? exist : specificExistOption
        if (!exist) return ''

        let image = ''
        const globalPreviewOption = config.feeds.imgPreviews != null ? config.feeds.imgPreviews : defaultConfigs.feeds.imgPreviews.default // Always a boolean via startup checks
        image = globalPreviewOption ? link : `<${link}>`
        const specificPreviewOption = source.imgPreviews
        image = typeof specificPreviewOption !== 'boolean' ? image : specificPreviewOption === true ? link : `<${link}>`

        return image
      }
    }
  })

  text = text.replace(/\n\s*\n\s*\n/g, '\n\n') // Replace triple line breaks with double
  const arr = text.split('\n')
  for (var q = 0; q < arr.length; ++q) arr[q] = arr[q].replace(/\s+$/, '') // Remove trailing spaces
  return arr.join('\n')
}

module.exports = class Article {
  constructor (raw, guildRss, rssName) {
    const source = guildRss.sources[rssName]
    this.reddit = raw.meta.link && raw.meta.link.includes('www.reddit.com')
    this.youtube = raw.guid && raw.guid.startsWith('yt:video') && raw['media:group'] && raw['media:group']['media:description'] && raw['media:group']['media:description']['#']
    this.enabledRegex = typeof source.regexOps === 'object' && source.regexOps.disabled !== true
    this.placeholdersForRegex = BASE_REGEX_PHS.slice()
    this.meta = raw.meta
    this.guid = raw.guid
    this.author = raw.author ? cleanup(source, raw.author) : ''
    this.link = raw.link ? raw.link.split(' ')[0].trim() : '' // Sometimes HTML is appended at the end of links for some reason
    if (this.reddit && this.link.startsWith('/r/')) this.link = 'https://www.reddit.com' + this.link

    // Title
    const titleImgs = []
    this.fullTitle = cleanup(source, raw.title, titleImgs)
    this.title = this.fullTitle.length > 150 ? `${this.fullTitle.slice(0, 150)}...` : this.fullTitle
    this.titleImgs = titleImgs
    for (var titleImgNum in titleImgs) {
      const term = `description:image${parseInt(titleImgNum, 10) + 1}`
      this[term] = titleImgs[titleImgNum]
      if (this.enabledRegex) this.placeholdersForRegex.push(term)
    }

    // guid - Raw exposure, no cleanup. Not meant for use by most feeds.
    this.guid = raw.guid ? raw.guid : ''

    // Date
    if ((raw.pubdate && raw.pubdate.toString() !== 'Invalid Date') || config.feeds.dateFallback === true) {
      const guildTimezone = guildRss.timezone
      const timezone = (guildTimezone && moment.tz.zone(guildTimezone)) ? guildTimezone : config.feeds.timezone
      const dateFormat = guildRss.dateFormat ? guildRss.dateFormat : config.feeds.dateFormat

      const useDateFallback = config.feeds.dateFallback === true && (!raw.pubdate || raw.pubdate.toString() === 'Invalid Date')
      const useTimeFallback = config.feeds.timeFallback === true && raw.pubdate.toString() !== 'Invalid Date' && dateHasNoTime(raw.pubdate)
      const date = useDateFallback ? new Date() : raw.pubdate
      const localMoment = moment(date)
      if (guildRss.dateLanguage) localMoment.locale(guildRss.dateLanguage)
      const vanityDate = useTimeFallback ? setCurrentTime(localMoment).tz(timezone).format(dateFormat) : localMoment.tz(timezone).format(dateFormat)
      this.date = (vanityDate !== 'Invalid Date') ? vanityDate : ''
      this.rawDate = this.date
    }

    // Description and reddit-specific placeholders
    const descriptionImages = []
    this.fullDescription = this.youtube ? raw['media:group']['media:description']['#'] : cleanup(source, raw.description, descriptionImages) // Account for youtube's description
    let description = this.fullDescription
    description = description.length > 800 ? `${description.slice(0, 790)}...` : description
    for (var desImgNum in descriptionImages) {
      const term = `description:image${parseInt(desImgNum, 10) + 1}`
      this[term] = descriptionImages[desImgNum]
      if (this.enabledRegex) this.placeholdersForRegex.push(term)
    }

    // Get the specific reddit placeholders {reddit_direct} and {reddit_author}
    if (this.reddit) {
      htmlConvert.fromString(raw.description, {
        format: {
          anchor: (node, fn, options) => {
            const child = node.children[0]
            if (child && child.data === '[link]') this.reddit_direct = node.attribs.href === this.link ? '' : (node.attribs.href || '')
            if (this.enabledRegex) this.placeholdersForRegex.push('reddit_direct')
            if (child && child.data && child.data.startsWith(' /u/')) this.reddit_author = node.attribs.href || ''
            if (this.enabledRegex) this.placeholdersForRegex.push('reddit_author')
            // No need to return anything since the output of htmlConvert.fromString isn't needed
          }
        }
      })
      this.fullDescription = this.fullDescription.replace('\n[link] [comments]', '')
      description = description.replace('\n[link] [comments]', '') // Truncate the useless end of reddit description after anchors are removed
    } else this.reddit_direct = this.reddit_author = ''

    this.description = description
    this.descriptionImgs = descriptionImages

    // Summary
    const summaryImages = []
    this.fullSummary = cleanup(source, raw.summary, summaryImages)
    this.summary = this.fullSummary.length > 800 ? `${this.fullSummary.slice(0, 790)}...` : this.fullSummary
    this.summaryImgs = summaryImages
    for (var sumImgNum in summaryImages) {
      const term = `summary:image${parseInt(sumImgNum, 10) + 1}`
      this[term] = summaryImages[sumImgNum]
      if (this.enabledRegex) this.placeholdersForRegex.push(term)
    }

    // Image links
    const imageLinks = []
    findImages(raw, imageLinks)
    this.images = (imageLinks.length === 0) ? undefined : imageLinks
    for (var imageNum in imageLinks) {
      const term = `image:${parseInt(imageNum, 10) + 1}`
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
      this.tags = categoryList
    }

    // Regex-defined custom placeholders
    if (this.enabledRegex) {
      this.regexPlaceholders = {} // Each key is a validRegexPlaceholder, and their values are an object of named placeholders with the modified content
      for (var b in this.placeholdersForRegex) {
        const placeholderName = this.placeholdersForRegex[b]
        const regexResults = evalRegexConfig(source, this[placeholderName], placeholderName)
        this.regexPlaceholders[placeholderName] = regexResults
      }
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
      const placeholderImgs = this[VALID_PH_IMGS[k] + 'Imgs']
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
      const validPlaceholders = ['title', 'description', 'summary']
      const placeholder = arr[0].replace(/{|}/, '')
      const placeholderImgs = this[placeholder + 'Imgs']
      if (!validPlaceholders.includes(placeholder) || !placeholderImgs || placeholderImgs.length < 1) continue

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
    const phImageLocs = content.match(/({(description|image|title):image[1-5](\|\|(.+))*})/gi)
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
    if (this.reddit) content = content.replace(/{reddit_direct}/g, this.reddit_direct)
    return content
  }

  // replace simple keywords
  convertKeywords (word, ignoreCharLimits) {
    if (word.length === 0) return word
    const regexPlaceholders = this.regexPlaceholders
    let content = word.replace(/{date}/g, this.date)
      .replace(/{title}/g, ignoreCharLimits ? this.fullTitle : this.title)
      .replace(/{author}/g, this.author)
      .replace(/{summary}/g, ignoreCharLimits ? this.fullSummary : this.summary)
      .replace(/{subscriptions}/g, this.subscriptions)
      .replace(/{link}/g, this.link)
      .replace(/{description}/g, ignoreCharLimits ? this.fullDescription : this.description)
      .replace(/{tags}/g, this.tags)
      .replace(/{guid}/g, this.guid)

    if (this.reddit) content = content.replace(/{reddit_author}/g, this.reddit_author).replace(/{reddit_direct}/g, this.reddit_direct)

    for (var placeholder in regexPlaceholders) {
      for (var customName in regexPlaceholders[placeholder]) {
        const replacementQuery = new RegExp(`{${placeholder}:${escapeRegExp(customName)}}`, 'g')
        const replacementContent = regexPlaceholders[placeholder][customName]
        content = content.replace(replacementQuery, replacementContent)
      }
    }
    return this.convertImgs(content)
  }
}
