const config = require('../../config.json')
const moment = require('moment-timezone')
const cleanEntities = require('entities')
const currentGuilds = require('../../util/storage.js').currentGuilds
const htmlConvert = require('html-to-text')

// To avoid stack call exceeded
function checkObjType (item, results) {
  if (Object.prototype.toString.call(item) === '[object Object]') {
    return function () {
      return findImages(item, results)
    }
  } else if (typeof item === 'string' && item.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && !results.includes(item) && results.length < 9) results.push(item)
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

function regexReplace (string, regexSearchQuery, replacementData, flags) {
  try {
    let newMatch
    if (replacementData.type === 'regex') {
      const newMatchIndex = replacementData.matchNumber
      const newRegExp = new RegExp(replacementData.content, flags)
      newMatch = newRegExp.exec(string)[newMatchIndex]
    } else if (replacementData.type === 'string') newMatch = replacementData.content

    const oldRegExp = new RegExp(regexSearchQuery, flags)
    const oldMatches = []
    let oldMatch
    while ((oldMatch = oldRegExp.exec(string)) && !oldMatches.includes(oldMatch[0])) {
      oldMatches.push(oldMatch[0])
    }
    for (var x in oldMatches) { // oldMatches is an array of strings
      let exp = new RegExp(escapeRegExp(oldMatches[x]), flags)
      string = string.replace(exp, newMatch)
    }

    return string
  } catch (e) {
    return e
  }
}

// To avoid stack call exceeded
// function trampoline (func, obj, results) {
//   var value = func(obj, results)
//   while (typeof value === 'function') {
//     value = value()
//   }
//   return value
// }
//
// // Used to find images in any object values of the article
// function findImages (obj, results) {
//   for (var key in obj) {
//     if (Object.prototype.toString.call(obj[key]) === '[object Object]' && isNotEmpty(obj[key])) {
//       return function () {
//         return findImages(obj[key], results)
//       }
//     } else if (typeof obj[key] === 'string' && obj[key].match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && !results.includes(obj[key]) && results.length < 9) results.push(obj[key])
//   }
// }

module.exports = function Article (rawArticle, guildId, rssName) {
  const guildRss = currentGuilds.get(guildId)
  const rssList = guildRss.sources

  function evalRegexConfig (text, placeholder) {
    const source = rssList[rssName]
    let newText = text

    if (typeof source.regexOps === 'object' && source.regexOps.disabled !== true && Array.isArray(source.regexOps[placeholder])) { // Eval regex if specified
      if (Array.isArray(source.regexOps.disabled) && source.regexOps.disabled.length > 0) { // .disabled can be an array of disabled placeholders, or just a boolean to disable everything
        for (var y in source.regexOps.disabled) { // Looping through strings of placeholders
          if (source.regexOps.disabled[y] === placeholder) return text
        }
      }
      for (var regexOpIndex in source.regexOps[placeholder]) { // Looping through each regexOp for a placeholder
        let regexOp = source.regexOps[placeholder][regexOpIndex]
        if (regexOp.disabled === true) continue

        let modified = regexReplace(newText, regexOp.search, regexOp.replacement, regexOp.flags)
        if (typeof modified !== 'string') {
          if (config.feedSettings.showRegexErrs !== false) console.log(`Error found while evaluating regex for feed ${source.link}:\n`, modified)
        } else newText = modified
      }
    } else return text

    return newText
  }

  function cleanRandoms (text, imgSrcs) {
    if (!text) return text

    text = text.replace(/\*/gi, '')
            .replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, '**$2**') // Bolded markdown
            .replace(/<(em|i)>(.*?)<(\/(em|i))>/gi, '*$2*') // Italicized markdown
            .replace(/<(u)>(.*?)<(\/(u))>/gi, '__$2__') // Underlined markdown

    text = htmlConvert.fromString(text, {
      ignoreHref: true,
      noLinkBrackets: true,
      format: {
        image: function (node, options) {
          if (Array.isArray(imgSrcs) && imgSrcs.length < 5) imgSrcs.push(node.attribs.src)

          if (rssList[rssName].disableImgLinks === true || config.feedSettings.imageLinksExistence === false) return ''
          else return rssList[rssName].disableImgLinkPreviews === true || config.feedSettings.imagePreviews === false ? `<${node.attribs.src}>` : node.attribs.src
        },
        heading: function (node, fn, options) {
          let h = fn(node.children, options);
          return h;
        }
      }
    })

    text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace triple line breaks with double
    return text
  }

  this.rawDescrip = cleanRandoms(rawArticle.description)
  this.rawSummary = cleanRandoms(rawArticle.summary)
  this.meta = rawArticle.meta
  this.guid = rawArticle.guid
  this.author = (rawArticle.author) ? cleanRandoms(rawArticle.author) : ''
  this.link = (rawArticle.link) ? rawArticle.link.split(' ')[0].trim() : '' // Sometimes HTML is appended at the end of links for some reason

  // TITLE
  const rawTitleImgs = []
  this.title = (!rawArticle.title) ? '' : cleanRandoms(rawArticle.title, rawTitleImgs)
  this.title = evalRegexConfig(this.title, 'title')
  this.title = this.title.length > 150 ? this.title.slice(0, 150) + ' [...]' : this.title
  this.titleImgs = rawTitleImgs

  // date
  const guildTimezone = guildRss.timezone
  const timezone = (guildTimezone && moment.tz.zone(guildTimezone)) ? guildTimezone : config.feedSettings.timezone
  const timeFormat = (config.feedSettings.timeFormat) ? config.feedSettings.timeFormat : 'ddd, D MMMM YYYY, h:mm A z'
  const vanityDate = moment.tz(rawArticle.pubdate, timezone).format(timeFormat)
  this.pubdate = (vanityDate !== 'Invalid date') ? vanityDate : ''

  // DESCRIPTION
  let rawArticleDescrip = ''
  const rawDescripImgs = []
  // YouTube doesn't use the regular description field, thus manually setting it as the description
  if (rawArticle.guid && rawArticle.guid.startsWith('yt:video') && rawArticle['media:group'] && rawArticle['media:group']['media:description'] && rawArticle['media:group']['media:description']['#']) rawArticleDescrip = rawArticle['media:group']['media:description']['#']
  else if (rawArticle.description) rawArticleDescrip = cleanRandoms(rawArticle.description, rawDescripImgs)
  rawArticleDescrip = (rawArticleDescrip.length > 800) ? `${rawArticleDescrip.slice(0, 790)} [...]` : rawArticleDescrip

  if (this.meta.link && this.meta.link.includes('reddit')) {
    rawArticleDescrip = rawArticleDescrip.replace('\n[link] [comments]', '') // truncate the useless end of reddit description
  }

  rawArticleDescrip = evalRegexConfig(rawArticleDescrip, 'description')
  this.description = rawArticleDescrip

  let descripImgList = ''
  if (rawDescripImgs.length > 0) {
    for (var j in rawDescripImgs) {
      descripImgList += `\n${parseInt(j, 10) + 1}) ${rawDescripImgs[j]}`
    }
  }
  this.descriptionImgs = rawDescripImgs

  // SUMMARY
  let rawArticleSummary = ''
  const rawSummaryImgs = []
  if (rawArticle.summary) rawArticleSummary = cleanRandoms(rawArticle.summary, rawSummaryImgs)
  rawArticleSummary = evalRegexConfig(rawArticleSummary, 'summary')
  rawArticleSummary = (rawArticleSummary.length > 800) ? `${rawArticleSummary.slice(0, 790)} [...]` : rawArticleSummary
  this.summary = rawArticleSummary
  this.summaryImgs = rawSummaryImgs

  // LIST all {imageX} to string
  const imageLinks = []
  findImages(rawArticle, imageLinks)
  this.images = (imageLinks.length === 0) ? undefined : imageLinks

  this.listImages = function () {
    let imageList = ''
    for (var image in this.images) {
      imageList += `[Image${parseInt(image, 10) + 1} URL]: {image${parseInt(image, 10) + 1}}\n${this.images[image]}`
      if (parseInt(image, 10) !== this.images.length - 1) imageList += '\n'
    }
    return imageList
  }

  // LIST all {placeholder:imageX} to string
  this.listPlaceholderImages = function () {
    const validPlaceholders = ['title', 'description', 'summary']
    const listedImages = []
    let list = ''
    for (var k in validPlaceholders) {
      const placeholderImgs = this[validPlaceholders[k] + 'Imgs']
      for (var l in placeholderImgs) {
        if (listedImages.includes(placeholderImgs[l])) continue
        listedImages.push(placeholderImgs[l])
        const placeholder = validPlaceholders[k].slice(0, 1).toUpperCase() + validPlaceholders[k].substr(1, validPlaceholders[k].length)
        const imgNum = parseInt(l, 10) + 1
        list += `\n[${placeholder} Image${imgNum}]: {${validPlaceholders[k]}:image${imgNum}}\n${placeholderImgs[l]}`
      }
    }

    return list.trim()
  }

  // CATEGORIES
  if (rawArticle.categories) {
    let categoryList = ''
    for (var category in rawArticle.categories) {
      categoryList += rawArticle.categories[category].trim()
      if (parseInt(category, 10) !== rawArticle.categories.length - 1) categoryList += '\n'
    }
    this.tags = categoryList
  }

  this.resolvePlaceholderImg = function (input) {
    const arr = input.split(':')
    if (arr.length === 1 || !arr[1].startsWith('image') || arr[1].length !== 7) return

    const validPlaceholders = ['title', 'description', 'summary']
    const placeholder = arr[0].substr(1, arr[0].length)
    const placeholderImgs = this[placeholder + 'Imgs']
    if (!validPlaceholders.includes(placeholder) || !placeholderImgs || placeholderImgs.length < 1) return

    const imgNum = parseInt(arr[1].replace(/[^1-9]/g, ''), 10) - 1
    if (isNaN(imgNum) || imgNum > 4 || imgNum < 0) return

    return placeholderImgs[imgNum]
  }

  // {imageX} and {placeholder:imageX}
  this.convertImgs = function (content) {
    const imgDictionary = {}
    const imgLocs = content.match(/{image.+}/g)
    const phImageLocs = content.match(/({(description|image|title):image[1-5]})/gi)

    if (imgLocs) {
      for (var loc in imgLocs) {
        if (imgLocs[loc].length === 8) { // only single digit image numbers
          let imgNum = parseInt(imgLocs[loc].substr(6, 1), 10)
          if (!isNaN(imgNum) && imgNum !== 0 && this.images && this.images[imgNum - 1]) imgDictionary[imgLocs[loc]] = this.images[imgNum - 1] // key is {imageX}, value is article image URL
          else if (!isNaN(imgNum) || imgNum === 0 || !this.images) imgDictionary[imgLocs[loc]] = ''
        }
      }
      for (var imgKeyword in imgDictionary) content = content.replace(new RegExp(imgKeyword, 'g'), imgDictionary[imgKeyword])
    }
    else if (phImageLocs) {
      for (var h in phImageLocs) {
        content = this.resolvePlaceholderImg(phImageLocs[h]) ? content.replace(phImageLocs[h], this.resolvePlaceholderImg(phImageLocs[h])) : content.replace(phImageLocs[h], '')
      }
    }

    return content
  }

  // replace simple keywords
  this.convertKeywords = function (word) {
    let content = word.replace(/{date}/g, this.pubdate)
            .replace(/{title}/g, this.title)
            .replace(/{author}/g, this.author)
            .replace(/{summary}/g, this.summary)
            .replace(/{subscriptions}/g, this.subscriptions)
            .replace(/{link}/g, this.link)
            .replace(/{description}/g, this.description)
            .replace(/{tags}/g, this.tags)

    return this.convertImgs(content)
  }

  return this
}
