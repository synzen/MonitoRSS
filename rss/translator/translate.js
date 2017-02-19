const config = require('../../config.json')
const striptags = require('striptags')
const filterFeed = require('./filters.js')
const createEmbed = require('./embed.js')
const cleanRandoms = require('./cleanup.js')
const moment = require('moment-timezone')
const getSubscriptions = require('./subscriptions.js')

module.exports = function (channel, rssList, rssIndex, data, isTestMessage) {
  const guildTimezone = require(`../../sources/${channel.guild.id}`).timezone

  // sometimes feeds get deleted mid process
  if (!rssList[rssIndex]) {console.log("RSS Error: Unable to translate a null source."); return null;}

  var originalDate = data.pubdate;

  var timezone = (guildTimezone && moment.tz.zone(guildTimezone)) ? guildTimezone : config.feedSettings.timezone
  var timeFormat = (config.feedSettings.timeFormat) ? config.feedSettings.timeFormat : "ddd, D MMMM YYYY, h:mm A z"
  var vanityDate = moment.tz(originalDate, timezone).format(timeFormat)

  var dataDescrip = ""
  if (data.guid && data.guid.startsWith("yt:video")) dataDescrip = data['media:group']['media:description']['#'];
  else if (data.description) dataDescrip = cleanRandoms(data.description);

  var dataSummary = ""
  if (data.summary) dataSummary = cleanRandoms(data.summary)

  dataSummary = (dataSummary.length > 800) ? `${dataSummary.slice(0, 800)} [...]` : dataSummary
  dataSummary = (isTestMessage && dataSummary.length > 300) ? `${dataSummary.slice(0, 300)}  [...]\n\n**(Truncated summary for shorter rsstest)**` : dataSummary
  dataDescrip = (dataDescrip.length > 800) ? `${dataDescrip.slice(0, 800)} [...]` : dataDescrip

  if (isTestMessage && dataDescrip.length > 300) {
    if (data.summary == data.description) dataDescrip = dataDescrip.slice(0, 600) + " [...]\n\n**(Truncated description for shorter rsstest)**";
    else dataDescrip = dataDescrip.slice(0, 300) + " [...]\n**(Truncated description for shorter rsstest)**";
  }

  if (data.meta.link && data.meta.link.includes("reddit")) {
    dataDescrip = dataDescrip.substr(0,dataDescrip.length-22)
    .replace("submitted by", "\n*Submitted by:*"); // truncate the useless end of reddit description
  }

  var subscriptions = getSubscriptions(channel, rssIndex, data, dataDescrip)

  function replaceKeywords(word){
    var a = word.replace(/{date}/g, vanityDate)
            .replace(/{title}/g, striptags(data.title))
            .replace(/{author}/g, data.author)
            .replace(/{summary}/g, dataSummary)
            .replace(/{image}/g, data.image.url)
            .replace(/{subscriptions}/g, subscriptions)

    if (data.link) var b = a.replace(/{link}/g, data.link);
    else var b = a.replace(/{link}/g, "");

    if (data.guid && data.guid.startsWith("yt:video")) { // youtube feeds have the property media:group that other feeds do not have
      if (data['media:group']['media:description']['#'] != null) var c = b.replace(/{description}/g, data['media:group']['media:description']['#']);
      else var c = b.replace(/{description}/g, "");

      var d = c.replace(/{thumbnail}/g, data['media:group']['media:thumbnail']['@']['url']);
      return d;
    }
    else return b.replace(/{description}/g, dataDescrip);
  }

  // filter message
  var filterPropCount = 0;
  if (rssList[rssIndex].filters && typeof rssList[rssIndex].filters == "object") {
    for (var prop in rssList[rssIndex].filters)
      if (rssList[rssIndex].filters.hasOwnProperty(prop) && prop !== "roleSubscriptions") filterPropCount++;
  }

  var filterExists = false
  var filterFound = false
  if (filterPropCount !== 0) {
    filterExists = true;
    filterFound = filterFeed(rssList, rssIndex, data, dataDescrip);
  }

  // feed article only passes through if the filter found the specified content
  if (!isTestMessage && filterExists && !filterFound) {
    console.log(`RSS Delivery: (${channel.guild.id}, ${channel.guild.name}) => ${data.link} did not pass filters and was not sent:\n`, rssList[rssIndex].filters);
    return null;
  }

  if (!rssList[rssIndex].message) var configMessage = replaceKeywords(config.feedSettings.defaultMessage);
  else var configMessage = replaceKeywords(rssList[rssIndex].message);

  // generate final msg
  var finalMessage = "";
  if (isTestMessage) {

    let footer = "\nBelow is the configured message to be sent for this feed:\n\n\n\n"
    finalMessage += `\`\`\`Markdown\n# Test Message\`\`\`\`\`\`Markdown\n\n[Title]: {title}\n${data.title}`;
    if (dataDescrip) finalMessage += `\n\n[Description]: {description}\n${dataDescrip}`
    if (data.description !== data.summary && dataSummary) finalMessage += `\n\n[Summary]: {summary}\n${dataSummary}`
    if (vanityDate) finalMessage += `\n\n[Published Date]: {date}\n${vanityDate}`
    if (data.author && data.author !== "") finalMessage += `\n\n[Author]: {author}\n${data.author}`
    if (data.link) finalMessage += `\n\n[Link]: {link}\n${data.link}`
    if (data.image.url && data.image.url !== "") finalMessage += `\n\n[Image URL]: {image}\n${data.image.url}`;
    if (subscriptions) finalMessage += `\n\n[Subscriptions]: {subscriptions}\n${subscriptions.split(" ").length - 1} subscriber(s)`;
    if (filterExists) finalMessage += `\n\n[Passed Filters?]: ${filterFound}`;
    if (data.guid && data.guid.startsWith("yt:video")) {
      finalMessage += `\n\n[Youtube Thumbnail]: {thumbnail}\n${data['media:group']['media:thumbnail']['@']['url']}\`\`\`` + footer + configMessage;
    }
    else finalMessage += "```" + footer + configMessage;

  }
  else finalMessage = configMessage;

  // account for final message length
  if (finalMessage.length >= 1900) {
    console.log(finalMessage);
    finalMessage = `The article titled **<${data.title}>** is greater than or equal to 1900 characters cannot be sent as a precaution. The link to the article is:\n\n${data.link}`;
    if (!isTestMessage) console.log(`RSS Delivery Warning: (${channel.guild.id}, ${channel.guild.name}) => Feed titled "${data.title}" cannot be sent to Discord because message length is >1900.`);
    else console.log(`RSS Test Delivery Warning: (${channel.guild.id}, ${channel.guild.name}) => Feed titled "${data.title}" cannot be sent to Discord because message length is >1900.`);

  }
  let finalMessageCombo = {
    textMsg: finalMessage
  }

  // check if embed is enabled
  var enabledEmbed;
  if (!rssList[rssIndex].embedMessage || !rssList[rssIndex].embedMessage.enabled) enabledEmbed = false;
  else enabledEmbed = true;

  if (enabledEmbed !== true) {
    if (!finalMessageCombo.textMsg) finalMessageCombo.textMsg = 'Cannot deliver an empty feed message.';
    return finalMessageCombo;
  }
  else {
    if (rssList[rssIndex].embedMessage.properties) finalMessageCombo.embedMsg = createEmbed(channel, rssList, rssIndex, data, replaceKeywords);
    return finalMessageCombo;
  }
}
