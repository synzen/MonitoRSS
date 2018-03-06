const Discord = require('discord.js')
const log = require('../../util/logger.js')
function isStr (str) { return str && typeof str === 'string' }

module.exports = (rssList, rssName, article) => {
  const embed = new Discord.RichEmbed()
  const embedSpecs = rssList[rssName].embedMessage.properties

  if (isStr(embedSpecs.message)) embed.setDescription(article.convertKeywords(embedSpecs.message))
  if (isStr(embedSpecs.footerText)) embed.setFooter(article.convertKeywords(embedSpecs.footerText), isStr(embedSpecs.footerIconURL) ? embedSpecs.footerIconURL : undefined)
  if (embedSpecs.color && !isNaN(embedSpecs.color)) {
    if (embedSpecs.color > 16777215 || embedSpecs.color < 0) {
      log.general.error(`Embed color property error for ${rssName}: Out of range color. Substituting in as '100'`)
      embed.setColor(100)
    } else embed.setColor(parseInt(embedSpecs.color, 10))
  } else if (isStr(embedSpecs.color) && embedSpecs.color.startsWith('#') && embedSpecs.color.length === 7) embed.setColor(embedSpecs.color)
  if (isStr(embedSpecs.authorTitle)) embed.setAuthor(article.convertKeywords(embedSpecs.authorTitle), isStr(embedSpecs.authorAvatarURL) ? article.convertKeywords(embedSpecs.authorAvatarURL) : undefined, isStr(embedSpecs.authorURL) ? article.convertKeywords(embedSpecs.authorURL) : undefined)
  if (isStr(embedSpecs.thumbnailURL)) embed.setThumbnail(article.convertImgs(embedSpecs.thumbnailURL))
  if (isStr(embedSpecs.imageURL)) embed.setImage(article.convertImgs(embedSpecs.imageURL))
  if (isStr(embedSpecs.url)) embed.setURL(article.convertKeywords(embedSpecs.url))
  else embed.setURL(article.link)
  if (isStr(embedSpecs.title)) {
    const t = article.convertKeywords(embedSpecs.title)
    embed.setTitle(t.length > 256 ? t.slice(0, 250) + '...' : t)
  }

  const fields = embedSpecs.fields
  if (Array.isArray(fields)) {
    for (var x = 0; x < fields.length; ++x) {
      const field = fields[x]
      const inline = field.inline === true
      
      let title = article.convertKeywords(field.title) 
      title = title.length > 256 ? title.slice(0, 250) + '...' : title
      
      let value = article.convertKeywords(field.value)
      value = value.length > 2048 ? value.slice(0, 2040) + '...' : value

      if (typeof title === 'string' && !title) embed.addBlankField(inline)
      else if (embed.fields.length < 10) embed.addField(title, value, inline)
    }
  }

  return embed
}
