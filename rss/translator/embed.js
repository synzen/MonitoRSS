const Discord = require('discord.js')

module.exports = function (channel, rssList, rssIndex, article, replaceKeywords) {
  var rssList = require(`../../sources/${channel.guild.id}`).sources
  var embed = new Discord.RichEmbed()

  let embedSpecs = rssList[rssIndex].embedMessage.properties;

  if (embedSpecs.message) embed.setDescription(replaceKeywords(embedSpecs.message));

  if (embedSpecs.footerText) embed.setFooter(replaceKeywords(embedSpecs.footerText));

  if (embedSpecs.color && !isNaN(embedSpecs.color)) {
    if (parseInt(embedSpecs.color) > 16777215 || parseInt(embedSpecs.color) < 0) {
      console.log(`EMBED ERROR! (${channel.guild.id}, ${channel.guild.name}) => Invalid color.`);
      embed.setColor('100');
    }
    else embed.setColor(embedSpecs.color);
  }

  if (embedSpecs.authorTitle) embed.setAuthor(replaceKeywords(embedSpecs.authorTitle));

  if (embedSpecs.authorTitle && embedSpecs.authorAvatarURL && typeof embedSpecs.authorAvatarURL === 'string') embed.setAuthor(embedSpecs.authorTitle, embedSpecs.authorAvatarURL);

  if (embedSpecs.thumbnailURL && typeof embedSpecs.thumbnailURL === 'string') embed.setThumbnail((new replaceKeywords('')).convertImgs(embedSpecs.thumbnailURL));

  if (embedSpecs.imageURL && typeof embedSpecs.imageURL === 'string') embed.setImage((new replaceKeywords('')).convertImgs(embedSpecs.imageURL))

  if (embedSpecs.url && typeof embedSpecs.url === 'string') embed.setURL(article.link);

  return embed;


}
