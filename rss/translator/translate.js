const config = require('../../config.json')
const filterFeed = require('./filters.js')
const createEmbed = require('./embed.js')
const Article = require('./article.js')
const getSubs = require('./subscriptions.js')

module.exports = function (channel, rssList, rssName, rawArticle, isTestMessage) {
  // temporary check, will probably be removed
  if (!rssList[rssName]) {console.log("RSS Error: Unable to translate a null source."); return null;}

  var article = new Article(rawArticle, channel)
  article.subscriptions = getSubs(channel, rssName, article)

  // Filter message
  var filterPropCount = 0;
  if (rssList[rssName].filters && typeof rssList[rssName].filters === "object") {
    for (var prop in rssList[rssName].filters) {
      // Check if any filter categories exists, excluding roleSubs
      if (prop !== "roleSubscriptions") filterPropCount++;
    }
  }

  var filterExists = false
  var filterResults = false
  if (filterPropCount > 0) {
    filterExists = true;
    filterResults = filterFeed(rssList, rssName, article, isTestMessage);
  }

  // Feed article only passes through if the filter found the specified content
  if (!isTestMessage && filterExists && !filterResults) {
    if (config.logging.showUnfiltered === true) console.log(`RSS Delivery: (${channel.guild.id}, ${channel.guild.name}) => '${(article.link) ? article.link : article.title}' did not pass filters and was not sent.`);
    return null;
  }

  var finalMessageCombo = {}
  // Check if embed is enabled
  if (rssList[rssName].embedMessage && rssList[rssName].embedMessage.enabled && rssList[rssName].embedMessage.properties) {
    finalMessageCombo.embedMsg = createEmbed(channel, rssList, rssName, article);
    finalMessageCombo.textMsg = (rssList[rssName].message) ? article.convertKeywords(rssList[rssName].message) : ''; // allow empty messages if embed is enabled
  }
  else finalMessageCombo.textMsg = (rssList[rssName].message) ? article.convertKeywords(rssList[rssName].message) : article.convertKeywords(config.feedSettings.defaultMessage);


  // Generate test details
  if (isTestMessage) {
    var testDetails = '';
    let footer = "\nBelow is the configured message to be sent for this feed:\n\n--";
    testDetails += `\`\`\`Markdown\n# Test Details\`\`\`\`\`\`Markdown\n\n[Title]: {title}\n${article.title}`;
    if (article.summary) {
      if (article.rawDescrip !== article.rawSummary) var testSummary = (article.summary.length > 700) ? `${article.summary.slice(0, 690)} [...]\n\n**(Truncated summary for shorter rsstest)**` : article.summary;
      else var testSummary = (article.summary.length > 375) ? `${article.summary.slice(0, 365)} [...]\n\n**(Truncated summary for shorter rsstest)**` : article.summary;

      testDetails += (article.rawSummary === article.rawDescrip) ? '' : `\n\n[Summary]: {summary}\n${testSummary}`;
    }
    if (article.description) {
      if (article.rawDescrip !== article.rawSummary) var testDescrip = (article.description.length > 750) ? `${article.description.slice(0, 690)} [...]\n\n**(Truncated description for shorter rsstest)**` : article.description;
      else var testDescrip = (article.description.length > 375) ? `${article.description.slice(0, 365)} [...]\n\n**(Truncated description for shorter rsstest)**` : article.description;
      testDetails += `\n\n[Description]: {description}\n${testDescrip}`;
    }
    if (article.pubdate) testDetails += `\n\n[Published Date]: {date}\n${article.pubdate}`;
    if (article.author) testDetails += `\n\n[Author]: {author}\n${article.author}`;
    if (article.link) testDetails += `\n\n[Link]: {link}\n${article.link}`;
    if (article.subscriptions) testDetails += `\n\n[Subscriptions]: {subscriptions}\n${article.subscriptions.split(" ").length - 1} subscriber(s)`;
    if (article.images) testDetails += `\n\n${article.listImages()}`;
    if (article.tags) testDetails += `\n\n[Tags]: {tags}\n${article.tags}`;
    if (filterExists) testDetails += `\n\n[Passed Filters?]: ${(filterResults) ? 'Yes' : 'No'}${filterResults}`;
    testDetails += "```" + footer;

    finalMessageCombo.testDetails = testDetails;
  }

  return finalMessageCombo;

}
