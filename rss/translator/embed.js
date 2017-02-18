module.exports = function (channel, rssList, rssIndex, data, replaceKeywords) {
  var rssList = require(`../../sources/${channel.guild.id}`).sources

  var embed = {embed: {
    author: {},
    fields: [],
    footer: {},
    image: {},
    thumbnail: {}
  }};

  let embedSpecs = rssList[rssIndex].embedMessage.properties;

  if (embedSpecs.message)
    embed.embed.description = replaceKeywords(embedSpecs.message);

  if (embedSpecs.footerText)
    embed.embed.footer.text = replaceKeywords(embedSpecs.footerText);

  if (embedSpecs.color && !isNaN(embedSpecs.color))
    embed.embed.color = embedSpecs.color;

  if (embedSpecs.authorTitle)
    embed.embed.author.name = replaceKeywords(embedSpecs.authorTitle);

  if (embedSpecs.authorAvatarURL && typeof embedSpecs.authorAvatarURL === 'string' && embedSpecs.authorAvatarURL.startsWith("http"))
    embed.embed.author.icon_url = embedSpecs.authorAvatarURL;

  if (embedSpecs.thumbnailURL && typeof embedSpecs.thumbnailURL === 'string') {
    if (data.guid && data.guid.startsWith("yt:video") && embedSpecs.thumbnailURL == "{thumbnail}") embed.embed.thumbnail.url = data['media:group']['media:thumbnail']['@']['url'];
    else embed.embed.thumbnail.url = embedSpecs.thumbnailURL;
  }

  if (embedSpecs.url && typeof embedSpecs.url === 'string')
    embed.embed.url = data.link;

  return embed;


}
