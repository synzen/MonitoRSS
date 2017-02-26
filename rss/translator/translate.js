const config = require('../../config.json')
const filterFeed = require('./filters.js')
const createEmbed = require('./embed.js')
const Article = require('./article.js')
const getSubs = require('./subscriptions.js')

module.exports = function (channel, rssList, rssIndex, rawArticle, isTestMessage) {
  // temporary check
  if (!rssList[rssIndex]) {console.log("RSS Error: Unable to translate a null source."); return null;}

  var article = new Article(rawArticle, channel)
  article.subscriptions = getSubs(channel, rssIndex, article)

  function replaceKeywords(word) {
    // simple replacements
    var converted = word.replace(/{date}/g, article.pubdate)
            .replace(/{title}/g, article.title)
            .replace(/{author}/g, article.author)
            .replace(/{summary}/g, article.summary)
            .replace(/{subscriptions}/g, article.subscriptions)
            .replace(/{link}/g, article.link)
            .replace(/{description}/g, article.description)
            .replace(/{tags}/g, article.tags)

    // replace images, defined as a separate function for use in embed.js
    this.convertImgs = function (converted) {
      var imgDictionary = {}
      var imgLocs = converted.match(/{image.+}/g)
      if (imgLocs && imgLocs.length > 0) {
        for (var loc in imgLocs) {
          if (imgLocs[loc].length === 8) { // only single digit image numbers
            let imgNum = parseInt(imgLocs[loc].substr(6, 1), 10);
            // key is {imageX}, value is article image URL
            if (!isNaN(imgNum) && imgNum !== 0 && article.images[imgNum - 1]) imgDictionary[imgLocs[loc]] = article.images[imgNum - 1];
            else if (!isNaN(imgNum) || imgNum === 0) imgDictionary[imgLocs[loc]] = '';
          }
        }
        for (var imgKeyword in imgDictionary) converted = converted.replace(new RegExp(imgKeyword, 'g'), imgDictionary[imgKeyword]);
      }
      return converted
    }
    converted = this.convertImgs(converted)
    return converted
  }

  // filter message
  var filterPropCount = 0;
  if (rssList[rssIndex].filters && typeof rssList[rssIndex].filters == "object") {
    for (var prop in rssList[rssIndex].filters)
      if (prop !== "roleSubscriptions") filterPropCount++;
  }

  var filterExists = false
  var filterResults = false
  if (filterPropCount !== 0) {
    filterExists = true;
    filterResults = filterFeed(rssList, rssIndex, article, isTestMessage);
  }

  // feed article only passes through if the filter found the specified content
  if (!isTestMessage && filterExists && !filterResults) {
    let info = (article.link) ? article.link : article.title;
    console.log(`RSS Delivery: (${channel.guild.id}, ${channel.guild.name}) => '${info}' did not pass filters and was not sent:\n`, rssList[rssIndex].filters);
    return null;
  }

  if (!rssList[rssIndex].message) var configTxtMsg = replaceKeywords(config.feedSettings.defaultMessage);
  else var configTxtMsg = replaceKeywords(rssList[rssIndex].message);

  // generate test details
  if (isTestMessage) {
    var testDetails = '';
    let footer = "\nBelow is the configured message to be sent for this feed:\n\n--";
    testDetails += `\`\`\`Markdown\n# Test Details\`\`\`\`\`\`Markdown\n\n[Title]: {title}\n${article.title}`;

    if (article.summary) {
      if (article.rawDescrip != article.rawSummary) var testSummary = (article.summary.length > 700) ? `${article.summary.slice(0, 690)} [...]\n\n**(Truncated summary for shorter rsstest)**` : article.summary;
      else var testSummary = (article.summary.length > 375) ? `${article.summary.slice(0, 365)} [...]\n\n**(Truncated summary for shorter rsstest)**` : article.summary;

      testDetails += (article.rawSummary == article.rawDescrip) ? '' : `\n\n[Summary]: {summary}\n${testSummary}`;
    }
    if (article.description) {
      if (article.rawDescrip != article.rawSummary) var testDescrip = (article.description.length > 750) ? `${article.description.slice(0, 690)} [...]\n\n**(Truncated description for shorter rsstest)**` : article.description;
      else var testDescrip = (article.description.length > 375) ? `${article.description.slice(0, 365)} [...]\n\n**(Truncated description for shorter rsstest)**` : article.description;
      testDetails += `\n\n[Description]: {description}\n${testDescrip}`;
    }


    if (article.pubdate) testDetails += `\n\n[Published Date]: {date}\n${article.pubdate}`;
    if (article.author && article.author !== "") testDetails += `\n\n[Author]: {author}\n${article.author}`;
    if (article.link) testDetails += `\n\n[Link]: {link}\n${article.link}`;
    if (article.subscriptions) testDetails += `\n\n[Subscriptions]: {subscriptions}\n${article.subscriptions.split(" ").length - 1} subscriber(s)`;
    if (article.images) testDetails += `\n\n${article.listImages()}`;
    if (article.tags) testDetails += `\n\n[Tags]: {tags}\n${article.tags}`
    if (filterExists) {
      let passedFilters = (filterResults) ? 'Yes' : 'No';
      testDetails += `\n\n[Passed Filters?]: ${passedFilters}${filterResults}`;
    }
    testDetails += "```" + footer;
  }

  var finalMessageCombo = {
    textMsg: configTxtMsg
  }
  if (isTestMessage) finalMessageCombo.testDetails = testDetails;

  // check if embed is enabled
  var enabledEmbed;
  if (!rssList[rssIndex].embedMessage || !rssList[rssIndex].embedMessage.enabled) enabledEmbed = false;
  else enabledEmbed = true;

  if (!enabledEmbed) return finalMessageCombo;
  else {
    if (rssList[rssIndex].embedMessage.properties) finalMessageCombo.embedMsg = createEmbed(channel, rssList, rssIndex, article, replaceKeywords);
    return finalMessageCombo;
  }
}
