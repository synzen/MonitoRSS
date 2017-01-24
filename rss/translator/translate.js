const rssConfig = require('../../config.json')
const striptags = require('striptags')
const filterFeed = require('./filters.js')
const createEmbed = require('./embed.js')
const cleanRandoms = require('./cleanup.js')
const moment = require('moment-timezone')

module.exports = function (channel, rssList, rssIndex, data, isTestMessage) {
  const guildTimezone = require(`../../sources/${channel.guild.id}`).timezone

  //sometimes feeds get deleted mid process
  if (rssList[rssIndex] == null) {console.log("RSS Error: Unhandled error. Trying to translate a null source. Please report."); return null;}
  if (data.guid == null) {console.log("Feed GUID is null. Unhandled error, please report.", data); return null;}

  var originalDate = data.pubdate;
  if (guildTimezone != null && moment.tz.zone(guildTimezone) != null) var timezone = guildTimezone;
  else var timezone = rssConfig.timezone;
  // var vanityDate = moment(originalDate).format("ddd, MMMM Do YYYY, h:mm A")
  var vanityDate = moment.tz(originalDate, timezone).format("ddd, MMMM Do YYYY, h:mm A z")

  var dataDescrip = ""
  if (data.guid.startsWith("yt:video")) dataDescrip = data['media:group']['media:description']['#'];
  else dataDescrip = cleanRandoms(striptags(data.description));

  if (dataDescrip.length > 700) {
    dataDescrip = dataDescrip.substr(0, 690) + " [...]";
  }
  if (isTestMessage && dataDescrip.length > 400) {
    dataDescrip = dataDescrip.substr(0, 390) + " [...]";
  }



  if (data.link != null && data.link.includes("reddit")) {
    let a = dataDescrip.substr(0,dataDescrip.length-22); //truncate the useless end of reddit description
    let b = a.replace("submitted by", "\n*Submitted by:*");
    dataDescrip = b;
  }

  var dataSummary = cleanRandoms(striptags(data.summary));
  if (dataSummary.length > 700)  {
    //if (isTestMessage) dataSummary = striptags(dataSummary).substr(0, 400) + " [...]";
    dataSummary = striptags(dataSummary).substr(0, 690) + " [...]";
  }

  function replaceKeywords(word){
    var a = word.replace(/{date}/g, vanityDate)
            .replace(/{title}/g, striptags(data.title))
            .replace(/{author}/g, data.author)
            .replace(/{summary}/g, dataSummary)
            .replace(/{image}/g, data.image.url)

    if (data.link != null) var b = a.replace(/{link}/g, data.link);
    else var b = a.replace(/{link}/g, "");

    if (data.guid.startsWith("yt:video")) { //youtube feeds have the property media:group that other feeds do not have
      if (data['media:group']['media:description']['#'] != null) var c = b.replace(/{description}/g, data['media:group']['media:description']['#']);
      else var c = b.replace(/{description}/g, "");

      var d = c.replace(/{thumbnail}/g, data['media:group']['media:thumbnail']['@']['url']);
      return d;
    }
    else
      return b.replace(/{description}/g, dataDescrip)
  }

  var configMessage = "";
  if (rssList[rssIndex].message == null) configMessage = replaceKeywords(rssConfig.defaultMessage);
  else configMessage = replaceKeywords(rssList[rssIndex].message);

  //filter message
  var filterExists = false
  var filterFound = false
  if (rssList[rssIndex].filters != null && typeof rssList[rssIndex].filters == "object") {
    filterExists = true;
    filterFound = filterFeed(rssList, rssIndex, data, dataDescrip);
  }

  //generate final msg
  var finalMessage = "";
  if (isTestMessage) {

    let footer = "\nBelow is the configured message to be sent for this feed set in config:\n\n\n\n"
    finalMessage += `\`\`\`Markdown\n# Test Message\`\`\`\`\`\`Markdown\n\n[Title]: {title}\n${data.title}`;
    if (dataDescrip != null && dataDescrip !== "") finalMessage += `\n\n[Description]: {description}\n${dataDescrip}`
    if (dataSummary !== dataDescrip && dataSummary != null && dataSummary !== "") finalMessage += `\n\n[Summary]: {summary}\n${dataSummary}`
    if (vanityDate != null && vanityDate !== "") finalMessage += `\n\n[Published Date]: {date}\n${vanityDate}`
    if (data.author != null && data.author !== "") finalMessage += `\n\n[Author]: {author}\n${data.author}`
    if (data.link != null) finalMessage += `\n\n[Link]: {link}\n${data.link}`
    if (data.image.url !=  null && data.image.url !== "") finalMessage += `\n\n[Image URL]: {image}\n${data.image.url}`;
    if (filterExists) finalMessage += `\n\n[Passed Filters?]: ${filterFound}`;
    if (data.guid.startsWith("yt:video")) {
      finalMessage += `\n\n[Youtube Thumbnail]: {thumbnail}\n${data['media:group']['media:thumbnail']['@']['url']}\`\`\`` + footer + configMessage;
    }
    else finalMessage += "```" + footer + configMessage;

  }
  else finalMessage = configMessage;

  //account for final message length
  if (finalMessage.length >= 1800) {
    console.log(finalMessage)
    finalMessage = `The feed titled **<${data.title}>** is greater than or equal to 1800 characters cannot be sent as a precaution. The link to the feed is:\n\n${data.link}`;
    console.log(`RSS Warning: (${channel.guild.id}, ${channel.guild.name}) => Feed titled "${data.title}" cannot be sent to Discord because message length is >1800.`)
  }
  let finalMessageCombo = {
    textMsg: finalMessage
  }

  //check if embed is enabled
  var enabledEmbed;
  if (rssList[rssIndex].embedMessage == null || rssList[rssIndex].embedMessage.enabled == false || rssList[rssIndex].embedMessage == "" || rssList[rssIndex].embedMessage.enabled == "")
    enabledEmbed = false;
  else enabledEmbed = true;

  //message only passes through if the filter found the specified content
  if (!isTestMessage && filterExists && !filterFound && finalMessage.length < 1900) {
    console.log(`RSS Delivery: (${channel.guild.id}, ${channel.guild.name}) => ${data.link} did not pass filters and was not sent:\n`, rssList[rssIndex].filters);
    return null;
  }
  else if (enabledEmbed !== true || finalMessage.length >= 1900) {
     return finalMessageCombo;
  }
  else {

    if (rssList[rssIndex].embedMessage.properties != null)
      finalMessageCombo.embedMsg = createEmbed(channel, rssList, rssIndex, data, replaceKeywords)

    return finalMessageCombo;
  }
}
