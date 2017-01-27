const striptags = require('striptags')
const rssConfig = require('./rss.json')
const rssList = rssConfig.sources
const moment = require('moment')

module.exports = (rssIndex, data) => {

  function replaceDate(word){
    var originalDate = data.pubdate;
    var vanityDate = moment(originalDate).format("ddd, MMMM Do YYYY, h:mm A zz") + " (EST)";

    return word.replace(/{date}/g, vanityDate)
  }

  function replaceDescription(word){
    return word.replace(/{description}/g, striptags(data.description));
  }

  function replaceYTDescription(word){
    if (!data.guid.includes("yt"))
      return word;
    else
      return word.replace(/{description:yt}/g, data['media:group']['media:description']['#']);
  }

  function replaceURL(word){
    return word.replace(/{url}/g, data.link)
  }

  function replaceTitle(word){
    return word.replace(/{title}/g, striptags(data.title))
  }

  function replaceYTThumbnail(word){
    if (!data.guid.includes("yt"))
      return word;
    else
      return word.replace(/{thumbnail:yt}/g, data['media:group']['media:thumbnail']['@']['url'])
  }

  var enabledEmbed;
  if (rssList[rssIndex].embedMessage == null || rssList[rssIndex].embedMessage.enabled == false || rssList[rssIndex].embedMessage == "" || rssList[rssIndex].embedMessage.enabled == "")
    enabledEmbed = false;
  else enabledEmbed = true;

  var message;
  if (rssList[rssIndex].message == null)
    message = rssConfig.defaultMessage;
  else
    message = rssList[rssIndex].message;

  function convertTypes(sentence) {
    var a = replaceTitle(sentence)
    var b = replaceYTDescription(a)
    var c = replaceYTThumbnail(b);
    var d = replaceDescription(c)
    var e = replaceURL(d)
    var f = replaceDate(e)

    return f;
  }

    var finalMessage = convertTypes(message);
    //console.log(embed.embed.author.title)


  if (enabledEmbed == false) return finalMessage;
  else {
    let finalMessageCombo = [];
    finalMessageCombo.push(finalMessage);
    var embed = {embed: {
      author: {},
      fields: [],
      footer: {},
      image: {},
      thumbnail: {}
    }};

    var errorEmbed = {embed: {
      description: "Advanced Embed option was selected but was not set in JSON.",
      author: {},
      fields: [],
      footer: {}
    }};

    if (rssList[rssIndex].embedMessage.useSimple == true &&  rssList[rssIndex].embedMessage.simpleEmbed != null) {
      let embedSpecs = rssList[rssIndex].embedMessage.simpleEmbed;

      if (embedSpecs.message !== null)
        embed.embed.description = convertTypes(embedSpecs.message);

      if (embedSpecs.footerText !== null)
        embed.embed.footer.text = convertTypes(embedSpecs.footerText);

      if (embedSpecs.color != null && embedSpecs.color !== "" && !isNaN(embedSpecs.color))
        embed.embed.color = embedSpecs.color;

      if (embedSpecs.title != null)
        embed.embed.author.name = convertTypes(embedSpecs.title);

      if (embedSpecs.avatarURL !== null && embedSpecs.avatarURL !== "" && embedSpecs.avatarURL.startsWith("http"))
        embed.embed.author.icon_url = embedSpecs.avatarURL;

      if (embedSpecs.thumbnailURL !== null && embedSpecs.thumbnailURL !== "")
        embed.embed.thumbnail.url = convertTypes(embedSpecs.thumbnailURL);

      if (embedSpecs.attachURL == true)
        embed.embed.url = data.link;

      finalMessageCombo.push(embed);
    }
    else if (rssList[rssIndex].embedMessage.useSimple == false) {
      if (rssList[rssIndex].embedMessage.advancedEmbed != null)
        finalMessageCombo.push(rssList[rssIndex].embedMessage.advancedEmbed);
      else finalMessageCombo.push(errorEmbed);
    }
    return finalMessageCombo;

  }

}
