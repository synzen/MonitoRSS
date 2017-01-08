const rssConfig = require('../../config.json')
const rssList = rssConfig.sources

module.exports = function (rssIndex, data, replaceKeywords) {

  var embed = {embed: {
    author: {},
    fields: [],
    footer: {},
    image: {},
    thumbnail: {}
  }};

  let embedSpecs = rssList[rssIndex].embedMessage.properties;

  if (embedSpecs.message !== null)
    embed.embed.description = replaceKeywords(embedSpecs.message);

  if (embedSpecs.footerText !== null)
    embed.embed.footer.text = replaceKeywords(embedSpecs.footerText);

  if (embedSpecs.color != null && embedSpecs.color !== "" && !isNaN(embedSpecs.color))
    embed.embed.color = embedSpecs.color;

  if (embedSpecs.authorTitle != null)
    embed.embed.author.name = replaceKeywords(embedSpecs.authorTitle);

  if (embedSpecs.authorAvatarURL !== null && embedSpecs.authorAvatarURL !== "" && embedSpecs.authorAvatarURL.startsWith("http"))
    embed.embed.author.icon_url = embedSpecs.authorAvatarURL;

  if (embedSpecs.thumbnailURL !== null && embedSpecs.thumbnailURL !== "")
    embed.embed.thumbnail.url = replaceKeywords(embedSpecs.thumbnailURL);

  if (embedSpecs.attachURL == true)
    embed.embed.url = data.link;

  return embed;


}
