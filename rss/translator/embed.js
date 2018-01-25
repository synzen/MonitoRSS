const Discord = require('discord.js')

function isStr(str) { return str && typeof str === 'string' }

module.exports = function (rssList, rssName, article) {
  const embed = new Discord.RichEmbed()
  const embedSpecs = rssList[rssName].embedMessage.properties

  if (isStr(embedSpecs.message)) embed.setDescription(article.convertKeywords(embedSpecs.message))

  if (isStr(embedSpecs.footerText)) embed.setFooter(article.convertKeywords(embedSpecs.footerText), isStr(embedSpecs.footerIconURL) ? embedSpecs.footerIconURL : undefined)

  if (embedSpecs.color && !isNaN(embedSpecs.color)) {
    if (embedSpecs.color > 16777215 || embedSpecs.color < 0) {
      console.log(`Translation Error: Embed color property error for ${rssName}: Out of range color. Substituting in as '100'.`)
      embed.setColor(100)
    } else embed.setColor(parseInt(embedSpecs.color, 10))
  } else if (isStr(embedSpecs.color) && embedSpecs.color.startsWith('#') && embedSpecs.color.length === 7) embed.setColor(embedSpecs.color)

  if (isStr(embedSpecs.authorTitle)) embed.setAuthor(article.convertKeywords(embedSpecs.authorTitle), isStr(embedSpecs.authorAvatarURL) ? article.convertKeywords(embedSpecs.authorAvatarURL) : undefined, isStr(embedSpecs.authorURL) ? article.convertKeywords(embedSpecs.authorURL) : undefined)

  if (isStr(embedSpecs.thumbnailURL)) embed.setThumbnail(article.convertImgs(embedSpecs.thumbnailURL))

  if (isStr(embedSpecs.imageURL)) embed.setImage(article.convertImgs(embedSpecs.imageURL))

  if (isStr(embedSpecs.url)) embed.setURL(article.convertKeywords(embedSpecs.url))
  else embed.setURL(article.link)

  if (isStr(embedSpecs.title)) embed.setTitle(article.convertKeywords(embedSpecs.title))

  const fields = embedSpecs.fields
  if (Array.isArray(fields)) {
    for (var x in fields) {
      const field = fields[x]
      const inline = field.inline === true ? true : false
      const title = field.title
      const value = field.value
      if (isStr(title) && !title) embed.addBlankField(inline)
      else embed.addField(article.convertKeywords(title), article.convertKeywords(value), inline)
    }
  }

  return embed
}
