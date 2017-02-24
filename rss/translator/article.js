const config = require('../../config.json')
const striptags = require('striptags')
const moment = require('moment-timezone')
const cleanEntities = require('entities')

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
  this.title = (!rawArticle.title) ? '' : (striptags(rawArticle.title).length > 100) ? `${striptags(rawArticle.title).slice(0, 100)} [...]` : striptags(rawArticle.title)
  this.author = striptags(rawArticle.author)
  this.link = (rawArticle.link) ? rawArticle.link : ''
  this.meta = rawArticle.meta
  this.guid = rawArticle.guid

  // date
  const guildTimezone = require(`../../sources/${channel.guild.id}`).timezone
  var timezone = (guildTimezone && moment.tz.zone(guildTimezone)) ? guildTimezone : config.feedSettings.timezone
  var timeFormat = (config.feedSettings.timeFormat) ? config.feedSettings.timeFormat : "ddd, D MMMM YYYY, h:mm A z"
  var vanityDate = moment.tz(rawArticle.pubdate, timezone).format(timeFormat)
  this.pubdate = vanityDate

  // description
  var rawArticleDescrip = ''
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
    var list = ''
    for (var image in this.images) list += `[Image${parseInt(image, 10) + 1} URL]: {image${parseInt(image, 10) + 1}}\n${this.images[image]}\n`;
    return list;
  }

  return this
}
