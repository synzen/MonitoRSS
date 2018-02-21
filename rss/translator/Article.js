const config = require('../../config.json')
const moment = require('moment-timezone')
const htmlConvert = require('html-to-text')
const defaultConfigs = require('../../util/configCheck.js').defaultConfigs
const VALID_PH_IMGS = ['title', 'description', 'summary']

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
  const flags = searchOptions.flags
  try {
    const matchIndex = searchOptions.match !== undefined ? parseInt(searchOptions.match, 10) : undefined
    const groupNum = searchOptions.group !== undefined ? parseInt(searchOptions.group, 10) : undefined
    const regExp = new RegExp(searchOptions.regex, flags)
    const matches = []
    let match
    while (match = regExp.exec(string)) { // Find everything that matches the search regex query and push it to matches.
      matches.push(match)
    }
    match = matches[matchIndex || 0][groupNum || 0]

    if (replacement !== undefined) {
      if (matchIndex === undefined && groupNum === undefined) { // If no match or group is defined, replace every full match of the search in the original string
        for (var x in matches) {
          const exp = new RegExp(escapeRegExp(matches[x][0]), flags)
          string = string.replace(exp, replacement)
        }
      } else if (matchIndex && groupNum === undefined) {  // If no group number is defined, use the full match of this particular match number in the original string
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

function evalRegexConfig (source, text, placeholder) {
  const customPlaceholders = {}

  if (typeof source.regexOps === 'object' && source.regexOps.disabled !== true && Array.isArray(source.regexOps[placeholder])) { // Eval regex if specified
    if (Array.isArray(source.regexOps.disabled) && source.regexOps.disabled.length > 0) { // .disabled can be an array of disabled placeholders, or just a boolean to disable everything
      for (var y in source.regexOps.disabled) { // Looping through strings of placeholders
        if (source.regexOps.disabled[y] === placeholder) return null // text
      }
    }

    const phRegexOps = source.regexOps[placeholder]
    for (var regexOpIndex in phRegexOps) { // Looping through each regexOp for a placeholder
      const regexOp = phRegexOps[regexOpIndex]
      if (regexOp.disabled === true || typeof regexOp.name !== 'string') continue

      if (!customPlaceholders[regexOp.name]) customPlaceholders[regexOp.name] = text // Initialize with a value if it doesn't exist

      const clone = Object.assign({}, customPlaceholders)

      const modified = regexReplace(clone[regexOp.name], regexOp.search, regexOp.replacement)
      if (typeof modified !== 'string') {
        if (config.feedSettings.showRegexErrs !== false) console.log(`Error found while evaluating regex for article ${source.link}\n`, modified)
      } else customPlaceholders[regexOp.name] = modified // newText = modified
    }
  } else return null
  return customPlaceholders
}

function cleanup (source, text, imgSrcs) {
  if (!text) return text

  text = text.replace(/\*/gi, '')
          .replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, '**$2**') // Bolded markdown
          .replace(/<(em|i)>(.*?)<(\/(em|i))>/gi, '*$2*') // Italicized markdown
          .replace(/<(u)>(.*?)<(\/(u))>/gi, '__$2__') // Underlined markdown

  text = htmlConvert.fromString(text, {
    wordwrap: null,
    ignoreHref: true,
    noLinkBrackets: true,
    format: {
      image: (node, options) => {
        const isStr = typeof node.attribs.src === 'string'
        let link = isStr ? node.attribs.src.trim() : node.attribs.src
        if (isStr && link.startsWith('//')) link = 'http:' + link
        else if (isStr && !link.startsWith('http://') && !link.startsWith('https://')) link = 'http://' + link

        if (Array.isArray(imgSrcs) && imgSrcs.length < 5 && isStr && link) imgSrcs.push(link)

        let exist = true
        const globalExistOption = config.feedSettings.imgLinksExistence != null ? config.feedSettings.imgLinksExistence : defaultConfigs.feedSettings.imgLinksExistence.default // Always a boolean via startup checks
        exist = globalExistOption
        const specificExistOption = source.imgLinksExistence
        exist = typeof specificExistOption !== 'boolean' ? exist : specificExistOption
        if (!exist) return ''

        let image = ''
        const globalPreviewOption = config.feedSettings.imgPreviews != null ? config.feedSettings.imgPreviews : defaultConfigs.feedSettings.imgPreviews.default // Always a boolean via startup checks
        image = globalPreviewOption ? link : `<${link}>`
        const specificPreviewOption = source.imgPreviews
        image = typeof specificPreviewOption !== 'boolean' ? image : specificPreviewOption === true ? link : `<${link}>`

        return image
      },
      heading: (node, fn, options) => {
        let h = fn(node.children, options)
        return h
      }
    }
  })

  text = text.replace(/\n\s*\n\s*\n/g, '\n\n') // Replace triple line breaks with double
  return text
}

module.exports = class Article {
  constructor (rawArticle, guildRss, rssName) {
    const source = guildRss.sources[rssName]

    this.rawDescrip = rawArticle.guid && rawArticle.guid.startsWith('yt:video') && rawArticle['media:group'] && rawArticle['media:group']['media:description'] && rawArticle['media:group']['media:description']['#'] ? cleanup(source, rawArticle['media:group']['media:description']['#']) : cleanup(source, rawArticle.description) // Account for youtube's description
    this.rawSummary = cleanup(source, rawArticle.summary)
    this.meta = rawArticle.meta
    this.guid = rawArticle.guid
    this.author = (rawArticle.author) ? cleanup(source, rawArticle.author) : ''
    this.link = (rawArticle.link) ? rawArticle.link.split(' ')[0].trim() : '' // Sometimes HTML is appended at the end of links for some reason
    if (this.meta.link && this.meta.link.includes('www.reddit.com') && this.link.startsWith('/r/')) this.link = 'https://www.reddit.com' + this.link

    // Title
    const rawTitleImgs = []
    this.title = (!rawArticle.title) ? '' : cleanup(source, rawArticle.title, rawTitleImgs)
    this.title = this.title.length > 150 ? this.title.slice(0, 150) + ' [...]' : this.title
    this.titleImgs = rawTitleImgs

    // Date
    if ((rawArticle.pubdate && rawArticle.pubdate.toString() !== 'Invalid Date') || config.feedSettings.dateFallback === true) {
      const guildTimezone = guildRss.timezone
      const timezone = (guildTimezone && moment.tz.zone(guildTimezone)) ? guildTimezone : config.feedSettings.timezone
      const dateFormat = guildRss.dateFormat ? guildRss.dateFormat : config.feedSettings.dateFormat

      const useDateFallback = config.feedSettings.dateFallback === true && (!rawArticle.pubdate || rawArticle.pubdate.toString() === 'Invalid Date')
      const useTimeFallback = config.feedSettings.timeFallback === true && rawArticle.pubdate.toString() !== 'Invalid Date' && dateHasNoTime(rawArticle.pubdate)
      const date = useDateFallback ? new Date() : rawArticle.pubdate
      const localMoment = moment(date)
      if (guildRss.dateLanguage) localMoment.locale(guildRss.dateLanguage)
      const vanityDate = useTimeFallback ? setCurrentTime(localMoment).tz(timezone).format(dateFormat) : localMoment.tz(timezone).format(dateFormat)
      this.date = (vanityDate !== 'Invalid Date') ? vanityDate : ''
    }

    // Description
    let rawArticleDescrip = ''
    const rawDescripImgs = []
    // YouTube doesn't use the regular description field, thus manually setting it as the description
    if (rawArticle.guid && rawArticle.guid.startsWith('yt:video') && rawArticle['media:group'] && rawArticle['media:group']['media:description'] && rawArticle['media:group']['media:description']['#']) rawArticleDescrip = rawArticle['media:group']['media:description']['#']
    else if (rawArticle.description) rawArticleDescrip = cleanup(source, rawArticle.description, rawDescripImgs)
    rawArticleDescrip = (rawArticleDescrip.length > 800) ? `${rawArticleDescrip.slice(0, 790)} [...]` : rawArticleDescrip

    if (this.meta.link && this.meta.link.includes('reddit')) {
      rawArticleDescrip = rawArticleDescrip.replace('\n[link] [comments]', '') // truncate the useless end of reddit description
    }

    this.description = rawArticleDescrip
    this.descriptionImgs = rawDescripImgs

    // Summary
    let rawArticleSummary = ''
    const rawSummaryImgs = []
    if (rawArticle.summary) rawArticleSummary = cleanup(source, rawArticle.summary, rawSummaryImgs)
    rawArticleSummary = (rawArticleSummary.length > 800) ? `${rawArticleSummary.slice(0, 790)} [...]` : rawArticleSummary
    this.summary = rawArticleSummary
    this.summaryImgs = rawSummaryImgs

    // Image links
    const imageLinks = []
    findImages(rawArticle, imageLinks)
    this.images = (imageLinks.length === 0) ? undefined : imageLinks

    // Categories/Tags
    if (rawArticle.categories) {
      let categoryList = ''
      for (var category in rawArticle.categories) {
        if (typeof rawArticle.categories[category] !== 'string') continue
        categoryList += rawArticle.categories[category].trim()
        if (parseInt(category, 10) !== rawArticle.categories.length - 1) categoryList += '\n'
      }
      this.tags = categoryList
    }

    // Regex-defined custom placeholders
    const validRegexPlaceholder = ['title', 'description', 'summary', 'author']
    this.regexPlaceholders = {} // Each key is a validRegexPlaceholder, and their values are an object of named placeholders with the modified content
    for (var b in validRegexPlaceholder) {
      const type = validRegexPlaceholder[b]
      const regexResults = evalRegexConfig(source, this[type], type)
      this.regexPlaceholders[type] = regexResults
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
    return content
  }

  // replace simple keywords
  convertKeywords (word) {
    const regexPlaceholders = this.regexPlaceholders
    let content = word.replace(/{date}/g, this.date)
            .replace(/{title}/g, this.title)
            .replace(/{author}/g, this.author)
            .replace(/{summary}/g, this.summary)
            .replace(/{subscriptions}/g, this.subscriptions)
            .replace(/{link}/g, this.link)
            .replace(/{description}/g, this.description)
            .replace(/{tags}/g, this.tags)

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
