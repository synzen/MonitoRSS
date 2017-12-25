const Discord = require('discord.js')

module.exports = function (rssList, rssName, article) {
  const embed = new Discord.RichEmbed()
  const embedSpecs = rssList[rssName].embedMessage.properties

  if (typeof embedSpecs.message === 'string') embed.setDescription(article.convertKeywords(embedSpecs.message))

  if (typeof embedSpecs.footerText === 'string') embed.setFooter(article.convertKeywords(embedSpecs.footerText), typeof embedSpecs.footerIconURL === 'string' ? embedSpecs.footerIconURL : null)

  if (embedSpecs.color && !isNaN(embedSpecs.color)) {
    if (embedSpecs.color > 16777215 || embedSpecs.color < 0) {
      console.log(`Translation Error: Embed color property error for ${rssName}: Out of range color. Substituting in as '100'.`)
      embed.setColor(100)
    } else embed.setColor(parseInt(embedSpecs.color, 10))
  } else if (typeof embedSpecs.color === 'string' && embedSpecs.color.startsWith('#') && embedSpecs.color.length === 7) embed.setColor(embedSpecs.color)

  if (typeof embedSpecs.authorTitle === 'string') embed.setAuthor(article.convertKeywords(embedSpecs.authorTitle))

  if (typeof embedSpecs.authorTitle === 'string' && typeof embedSpecs.authorAvatarURL === 'string') embed.setAuthor(article.convertKeywords(embedSpecs.authorTitle), article.convertKeywords(embedSpecs.authorAvatarURL))

  if (typeof embedSpecs.thumbnailURL === 'string') embed.setThumbnail(article.convertImgs(embedSpecs.thumbnailURL))

  if (typeof embedSpecs.imageURL === 'string') embed.setImage(article.convertImgs(embedSpecs.imageURL))

  if (typeof embedSpecs.url === 'string') embed.setURL(embedSpecs.url)
  else embed.setURL(article.link)

  if (typeof embedSpecs.title === 'string') embed.setTitle(article.convertKeywords(embedSpecs.title))

  const fields = embedSpecs.fields
  if (Array.isArray(fields)) {
    for (var x in fields) {
      const field = fields[x]
      const inline = field.inline === true ? true : false
      const title = field.title
      const value = field.value
      if (typeof title === 'string' && !title) embed.addBlankField(inline)
      else embed.addField(article.convertKeywords(title), article.convertKeywords(value), inline)
    }
  }

  return embed
}
