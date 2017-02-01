const rssConfig = require('../../config.json')
const striptags = require('striptags')
const filterFeed = require('./filters.js')
const createEmbed = require('./embed.js')
const cleanRandoms = require('./cleanup.js')
const moment = require('moment-timezone')
const getSubscriptions = require('./subscriptions.js')

module.exports = function (channel, rssList, rssIndex, data, isTestMessage) {
  const guildTimezone = require(`../../sources/${channel.guild.id}`).timezone
  require('fs').writeFileSync('./something.txt', data.description)
  //sometimes feeds get deleted mid process
  if (rssList[rssIndex] == null) {console.log("RSS Error: Unable to translate a null source."); return null;}
  if (data.guid == null) {console.log(`RSS Error: (${channel.guild.id}, ${channel.guild.name}) => Feed GUID is null.`, data); return null;}

  var originalDate = data.pubdate;
  if (guildTimezone != null && moment.tz.zone(guildTimezone) != null) var timezone = guildTimezone;
  else var timezone = rssConfig.timezone;
  // var vanityDate = moment(originalDate).format("ddd, MMMM Do YYYY, h:mm A")
  var vanityDate = moment.tz(originalDate, timezone).format("ddd, MMMM Do YYYY, h:mm A z")

  //var dataDescrip = ""
  if (data.guid.startsWith("yt:video")) var dataDescrip = data['media:group']['media:description']['#'];
  else var dataDescrip = cleanRandoms(data.description);

  var dataSummary = cleanRandoms(data.summary);
  if (dataSummary.length > 800)  {
    dataSummary = dataSummary.slice(0, 800) + " [...]";
  }
  if (isTestMessage && dataSummary.length > 300) {
    dataSummary = dataSummary.slice(0, 300) + " [...]\n\n**(Truncated shorter summary for rsstest)**";
  }

  if (dataDescrip.length > 800) {
    dataDescrip = dataDescrip.slice(0, 800) + " [...]";
  }
  if (isTestMessage && dataDescrip.length > 300) {
    if (data.summary == data.description) dataDescrip = dataDescrip.slice(0, 600) + " [...]\n\n**(Truncated shorter description for rsstest)**";
    else dataDescrip = dataDescrip.slice(0, 300) + " [...]\n(Truncated shorter description for rsstest)";
  }

  if (data.link != null && data.link.includes("reddit")) {
    dataDescrip = dataDescrip.substr(0,dataDescrip.length-22)
            .replace("submitted by", "\n*Submitted by:*"); //truncate the useless end of reddit description
  }

  var subscriptions = getSubscriptions(channel, rssIndex, data, dataDescrip)

  function replaceKeywords(word){
    var a = word.replace(/{date}/g, vanityDate)
            .replace(/{title}/g, striptags(data.title))
            .replace(/{author}/g, data.author)
            .replace(/{summary}/g, dataSummary)
            .replace(/{image}/g, data.image.url)
            .replace(/{subscriptions}/g, subscriptions)

    if (data.link != null) var b = a.replace(/{link}/g, data.link);
    else var b = a.replace(/{link}/g, "");

    if (data.guid.startsWith("yt:video")) { //youtube feeds have the property media:group that other feeds do not have
      if (data['media:group']['media:description']['#'] != null) var c = b.replace(/{description}/g, data['media:group']['media:description']['#']);
      else var c = b.replace(/{description}/g, "");

      var d = c.replace(/{thumbnail}/g, data['media:group']['media:thumbnail']['@']['url']);
      return d;
    }
    else return b.replace(/{description}/g, dataDescrip);
  }

  //filter message
  var filterPropCount = 0;
  if (rssList[rssIndex].filters != null && typeof rssList[rssIndex].filters == "object") {
    for (var prop in rssList[rssIndex].filters)
      if (rssList[rssIndex].filters.hasOwnProperty(prop) && prop !== "roleSubscriptions") filterPropCount++;
  }

  var filterExists = false
  var filterFound = false
  if (filterPropCount !== 0) {
    filterExists = true;
    filterFound = filterFeed(rssList, rssIndex, data, dataDescrip);
  }

  //feed article only passes through if the filter found the specified content
  if (!isTestMessage && filterExists && !filterFound) {
    console.log(`RSS Delivery: (${channel.guild.id}, ${channel.guild.name}) => ${data.link} did not pass filters and was not sent:\n`, rssList[rssIndex].filters);
    return null;
  }

  if (rssList[rssIndex].message == null) var configMessage = replaceKeywords(rssConfig.defaultMessage);
  else var configMessage = replaceKeywords(rssList[rssIndex].message);

  //generate final msg
  var finalMessage = "";
  if (isTestMessage) {

    let footer = "\nBelow is the configured message to be sent for this feed:\n\n\n\n"
    finalMessage += `\`\`\`Markdown\n# Test Message\`\`\`\`\`\`Markdown\n\n[Title]: {title}\n${data.title}`;
    if (dataDescrip != null && dataDescrip !== "") finalMessage += `\n\n[Description]: {description}\n${dataDescrip}`
    if (data.description !== data.summary && dataSummary != null && dataSummary !== "") finalMessage += `\n\n[Summary]: {summary}\n${dataSummary} (Summary has been truncated for test)`
    if (vanityDate != null && vanityDate !== "") finalMessage += `\n\n[Published Date]: {date}\n${vanityDate}`
    if (data.author != null && data.author !== "") finalMessage += `\n\n[Author]: {author}\n${data.author}`
    if (data.link != null) finalMessage += `\n\n[Link]: {link}\n${data.link}`
    if (data.image.url !=  null && data.image.url !== "") finalMessage += `\n\n[Image URL]: {image}\n${data.image.url}`;
    if (subscriptions !== "") finalMessage += `\n\n[Subscriptions]: {subscriptions}\n${subscriptions.split(" ").length - 1} subscriber(s)`;
    if (filterExists) finalMessage += `\n\n[Passed Filters?]: ${filterFound}`;
    if (data.guid.startsWith("yt:video")) {
      finalMessage += `\n\n[Youtube Thumbnail]: {thumbnail}\n${data['media:group']['media:thumbnail']['@']['url']}\`\`\`` + footer + configMessage;
    }
    else finalMessage += "```" + footer + configMessage;

  }
  else finalMessage = configMessage;

  //account for final message length
  if (finalMessage.length >= 1900) {
    console.log(finalMessage);
    finalMessage = `The article titled **<${data.title}>** is greater than or equal to 1900 characters cannot be sent as a precaution. The link to the article is:\n\n${data.link}`;
    if (!isTestMessage) console.log(`RSS Delivery Warning: (${channel.guild.id}, ${channel.guild.name}) => Feed titled "${data.title}" cannot be sent to Discord because message length is >1900.`);
    else console.log(`RSS Test Delivery Warning: (${channel.guild.id}, ${channel.guild.name}) => Feed titled "${data.title}" cannot be sent to Discord because message length is >1900.`);

  }
  let finalMessageCombo = {
    textMsg: finalMessage
  }

  //check if embed is enabled
  var enabledEmbed;
  if (rssList[rssIndex].embedMessage == null || rssList[rssIndex].embedMessage.enabled == false || rssList[rssIndex].embedMessage == "" || rssList[rssIndex].embedMessage.enabled == "")
    enabledEmbed = false;
  else enabledEmbed = true;


  if (enabledEmbed !== true) {
     return finalMessageCombo;
  }
  else {

    if (rssList[rssIndex].embedMessage.properties != null)
      finalMessageCombo.embedMsg = createEmbed(channel, rssList, rssIndex, data, replaceKeywords)

    return finalMessageCombo;
  }
}
