const Discord = require('discord.js')

module.exports = function(rssList, rssName, article) {
  const embed = new Discord.RichEmbed()
  const embedSpecs = rssList[rssName].embedMessage.properties;

  if (embedSpecs.message) embed.setDescription(article.convertKeywords(embedSpecs.message));

  if (embedSpecs.footerText) embed.setFooter(article.convertKeywords(embedSpecs.footerText));

  if (embedSpecs.color && !isNaN(embedSpecs.color)) {
    if (embedSpecs.color > 16777215 || embedSpecs.color < 0) {
      console.log(`Embed color property error for ${rssName}: Out of range color. Substituting in as '100'.`);
      embed.setColor('100');
    }
    else embed.setColor(embedSpecs.color);
  }

  if (embedSpecs.authorTitle) embed.setAuthor(article.convertKeywords(embedSpecs.authorTitle));

  if (embedSpecs.authorTitle && embedSpecs.authorAvatarURL && typeof embedSpecs.authorAvatarURL === 'string') embed.setAuthor(article.convertKeywords(embedSpecs.authorTitle), embedSpecs.authorAvatarURL);

  if (embedSpecs.thumbnailURL && typeof embedSpecs.thumbnailURL === 'string') embed.setThumbnail(article.convertImgs(embedSpecs.thumbnailURL));

  if (embedSpecs.imageURL && typeof embedSpecs.imageURL === 'string') embed.setImage(article.convertImgs(embedSpecs.imageURL));

  if (embedSpecs.url && typeof embedSpecs.url === 'string') embed.setURL(article.link);

  return embed


}
