const config = require('../../config.json')
const striptags = require('striptags')
const moment = require('moment-timezone')
const cleanEntities = require('entities')

// Used to find images in any object values of the article
function findImages(object, results) {
  for (var key in object) {
    if (typeof object[key] === 'string') {
      if (object[key].match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) && !results.includes(object[key]) && results.length < 9) {
        results.push(object[key]);
      }
    }
    if (typeof object[key] === 'object') findImages(object[key], results);
  }
  return false
}

// Clean up ridiculous spacings some articles may have in their descriptions/summaries
function cleanRandoms (text) {
  var a = cleanEntities.decodeHTML(text)
          .replace(/<br>/g, '\n')
          .replace(/<br \/>/g, '\n')
          .replace(/<br\/>/g, '\n')
          .replace(/\r\n/g, '\n')
          .replace(/\s\n/g, '\n')
          .replace(/\n /g, '\n')
          .replace(/ \n/g, '\n')
          // .replace(/\n\s/g,'\n')
          .replace(/\n\n\n\n/g, '\n\n')

  return striptags(a).trim()
}

module.exports = function Article(rawArticle, channel) {
  this.rawDescrip = striptags(rawArticle.description)
  this.rawSummary = striptags(rawArticle.summary)
  this.meta = rawArticle.meta
  this.guid = rawArticle.guid
  // Must be replaced with empty string if it exists in source config since these are replaceable tags
  this.title = (rawArticle.title) ? striptags(rawArticle.title) : ''
  this.author = (rawArticle.author) ? striptags(rawArticle.author): ''
  this.link = (rawArticle.link) ? rawArticle.link : ''

  // date
  const guildTimezone = require(`../../sources/${channel.guild.id}`).timezone
  var timezone = (guildTimezone && moment.tz.zone(guildTimezone)) ? guildTimezone : config.feedSettings.timezone
  var timeFormat = (config.feedSettings.timeFormat) ? config.feedSettings.timeFormat : "ddd, D MMMM YYYY, h:mm A z"
  var vanityDate = moment.tz(rawArticle.pubdate, timezone).format(timeFormat)
  this.pubdate = (vanityDate !== 'Invalid date') ? vanityDate : ''

  // description
  var rawArticleDescrip = ''
  // YouTube doesn't use the regular description field, thus manually setting it as the description
  if (rawArticle.guid && rawArticle.guid.startsWith('yt:video') && rawArticle['media:group']['media:description']['#']) rawArticleDescrip = rawArticle['media:group']['media:description']['#'];
  else if (rawArticle.description) rawArticleDescrip = cleanRandoms(rawArticle.description);
  rawArticleDescrip = (rawArticleDescrip.length > 800) ? `${rawArticleDescrip.slice(0, 790)} [...]` : rawArticleDescrip

  if (this.meta.link && this.meta.link.includes("reddit")) {
    rawArticleDescrip = rawArticleDescrip.substr(0, rawArticleDescrip.length - 22)
    .replace('submitted by', '\n*Submitted by:*'); // truncate the useless end of reddit description
  }

  this.description = rawArticleDescrip

  // summary
  var rawArticleSummary = ''
  if (rawArticle.summary) rawArticleSummary = cleanRandoms(rawArticle.summary);
  rawArticleSummary = (rawArticleSummary.length > 800) ? `${rawArticleSummary.slice(0, 790)} [...]` : rawArticleSummary
  this.summary = rawArticleSummary

  // image(s)
  var imageLinks = []
  findImages(rawArticle, imageLinks)
  this.images = (imageLinks.length == 0) ? undefined : imageLinks

  this.listImages = function () {
    var imageList = ''
    for (var image in this.images) {
      imageList += `[Image${parseInt(image, 10) + 1} URL]: {image${parseInt(image, 10) + 1}}\n${this.images[image]}`;
      if (image != this.images.length - 1) imageList += '\n';
    }
    return imageList;
  }

  // categories
  if (rawArticle.categories) {
    var categoryList = '';
    for (var category in rawArticle.categories) {
      categoryList += rawArticle.categories[category].trim();
      if (category != rawArticle.categories.length - 1) categoryList += '\n';
    }
    this.tags = categoryList;
  }

  // replace images
  this.convertImgs = function(content) {
    var imgDictionary = {}
    var imgLocs = content.match(/{image.+}/g)
    if (!imgLocs) return content;

    for (var loc in imgLocs) {
      if (imgLocs[loc].length === 8) {
        // only single digit image numbers
        let imgNum = parseInt(imgLocs[loc].substr(6, 1), 10);
        // key is {imageX}, value is article image URL
        if (!isNaN(imgNum) && imgNum !== 0 && this.images && this.images[imgNum - 1]) imgDictionary[imgLocs[loc]] = this.images[imgNum - 1];
        else if (!isNaN(imgNum) || imgNum === 0 || !this.images) imgDictionary[imgLocs[loc]] = '';
      }
    }
    for (var imgKeyword in imgDictionary) content = content.replace(new RegExp(imgKeyword, 'g'), imgDictionary[imgKeyword]);
    return content
  }

  // replace simple keywords
  this.convertKeywords = function(word) {
    var content = word.replace(/{date}/g, this.pubdate)
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
