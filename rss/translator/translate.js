const striptags = require('striptags')
const moment = require('moment')
const rssConfig = require('../../config.json')
const rssList = rssConfig.sources
const filterFeed = require('./filters.js')
const createEmbed = require('./embed.js')
const cleanRandoms = require('./cleanup.js')

module.exports = function (rssIndex, data, isTestMessage) {
  var originalDate = data.pubdate;
  var vanityDate = moment(originalDate).format("ddd, MMMM Do YYYY, h:mm A")
  if (rssConfig.timezone != null || rssConfig.timezone !== "") vanityDate += ` ${rssConfig.timezone}`

  var dataDescrip = ""
  if (data.guid.startsWith("yt:video")) dataDescrip = data['media:group']['media:description']['#'];
  else dataDescrip = cleanRandoms(striptags(data.description));
  if (dataDescrip.length > 1500) dataDescrip = dataDescrip.substr(0, 1400) + "[...]";

  if (data.link.includes("reddit")) {
    let a = dataDescrip.substr(0,dataDescrip.length-22); //truncate the useless end of reddit description
    let b = a.replace("submitted by", "\n*Submitted by:*");
    dataDescrip = b;
  }

  var dataSummary = cleanRandoms(striptags(data.summary))
  if (dataSummary.length > 1500)  dataSummary = striptags(data.summary).substr(0, 1400) + "[...]";

  function replaceKeywords(word){
    var a = word.replace(/{date}/g, vanityDate)
    var b = a.replace(/{title}/g, striptags(data.title))
    var c = b.replace(/{link}/g, data.link)
    var d = c.replace(/{author}/g, data.author)
    var e = d.replace(/{summary}/g, dataSummary)
    var f = e.replace(/{image}/g, data.image.url)

    if (data.guid.startsWith("yt:video")) { //youtube feeds have the property media:group that other feeds do not have
      if (data['media:group']['media:description']['#'] != null)
        var g = f.replace(/{description}/g, data['media:group']['media:description']['#']);
      else var g = f.replace(/{description}/g, "");

      var h = g.replace(/{thumbnail}/g, data['media:group']['media:thumbnail']['@']['url']);
      return h;
    }
    else
      return f.replace(/{description}/g, dataDescrip)
  }

  var configMessage = "";
  if (rssList[rssIndex].message == null) configMessage = replaceKeywords(rssConfig.defaultMessage);
  else configMessage = replaceKeywords(rssList[rssIndex].message);

  //filter message
  var filterExists = false
  var filterFound = false
  if (rssList[rssIndex].filters != null && typeof rssList[rssIndex].filters == "object") {
    filterExists = true;
    filterFound = filterFeed(rssIndex, data, dataDescrip);
  }

  //generate final msg
  var finalMessage = "";
  if (isTestMessage) {

    if (dataSummary.length >= 1000 && dataDescrip.length >= 1000) {
      dataSummary = striptags(data.summary).substr(0, 750) + "[...]";
      dataDescrip = dataDescrip.substr(0, 750) + "[...]";
    }

    let footer = "\nBelow is the configured message to be sent for this feed set in config:\n\n\n\n"
    finalMessage += `\`\`\`Markdown\n# ${data.link}\`\`\`\`\`\`Markdown\n\n[Title]: {title}\n${data.title}`;
    if (dataDescrip != null && dataDescrip !== "") finalMessage += `\n\n[Description]: {description}\n${dataDescrip}`
    if (dataSummary != null && dataSummary !== "") finalMessage += `\n\n[Summary]: {summary}\n${dataSummary}`
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
    finalMessage = `Warning: The feed titled **${data.title}** is greater than or equal to 1800 characters cannot be sent as a precaution. The link to the feed is:\n\n${data.link}`;
    console.log(`RSS Warning: Feed titled "${data.title}" cannot be sent to Discord because message length is >1800.`)
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
  if (!filterFound && !isTestMessage && filterExists && finalMessage.length < 1900) {
    console.log(`RSS Info: Filter did not find keywords. Skipping "${data.title}".`)
    return false;
  }
  else if (enabledEmbed !== true || finalMessage.length >= 1900) {
     return finalMessageCombo;
  }
  else {

    if (rssList[rssIndex].embedMessage.properties != null)
      finalMessageCombo.embedMsg = createEmbed(rssIndex, data, replaceKeywords)

    return finalMessageCombo;
  }
}
