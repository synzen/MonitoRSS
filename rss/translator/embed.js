const Discord = require('discord.js')
const isStr = str => str && typeof str === 'string'

module.exports = (embedMessage, article) => {
  const embed = new Discord.RichEmbed()
  const embedSpecs = embedMessage.properties

  if (isStr(embedSpecs.message)) embed.setDescription(article.convertKeywords(embedSpecs.message))
  if (isStr(embedSpecs.footerText)) embed.setFooter(article.convertKeywords(embedSpecs.footerText), isStr(embedSpecs.footerIconURL) ? article.convertKeywords(embedSpecs.footerIconURL) : undefined)
  if (embedSpecs.color && !isNaN(embedSpecs.color) && embedSpecs.color <= 16777215 && embedSpecs.color > 0) embed.setColor(parseInt(embedSpecs.color, 10))
  else if (isStr(embedSpecs.color) && embedSpecs.color.startsWith('#') && embedSpecs.color.length === 7) embed.setColor(embedSpecs.color)
  if (isStr(embedSpecs.authorTitle)) embed.setAuthor(article.convertKeywords(embedSpecs.authorTitle), isStr(embedSpecs.authorAvatarURL) ? article.convertKeywords(embedSpecs.authorAvatarURL) : undefined, isStr(embedSpecs.authorURL) ? article.convertKeywords(embedSpecs.authorURL) : undefined)
  if (isStr(embedSpecs.thumbnailURL)) embed.setThumbnail(article.convertImgs(embedSpecs.thumbnailURL))
  if (isStr(embedSpecs.imageURL)) embed.setImage(article.convertImgs(embedSpecs.imageURL))
  if (isStr(embedSpecs.url)) embed.setURL(article.convertKeywords(embedSpecs.url))
  else embed.setURL(article.link)
  if (isStr(embedSpecs.title)) {
    const t = article.convertKeywords(embedSpecs.title)
    embed.setTitle(t.length > 256 ? t.slice(0, 250) + '...' : t)
  }
  if (isStr(embedSpecs.timestamp)) {
    const setting = embedSpecs.timestamp
    embed.setTimestamp(setting === 'article' ? new Date(article.rawDate) : setting === 'now' ? new Date() : new Date(setting)) // No need to check for invalid date since discord.js does it
  }

  const fields = embedSpecs.fields
  if (Array.isArray(fields)) {
    for (var x = 0; x < fields.length; ++x) {
      const field = fields[x]
      const inline = field.inline === true

      let title = article.convertKeywords(field.title)
      title = title.length > 256 ? title.slice(0, 250) + '...' : title

      let value = article.convertKeywords(field.value ? field.value : '')
      value = value.length > 1024 ? value.slice(0, 1020) + '...' : value.length > 0 ? value : '\u200b'

      if (typeof title === 'string' && !title) embed.addBlankField(inline)
      else if (embed.fields.length < 10) embed.addField(title, value, inline)
    }
  }

  return embed
}
