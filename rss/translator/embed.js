const Discord = require('discord.js')
const isStr = str => str && typeof str === 'string'

// objectEmbed.message => embed.description

module.exports = (embeds, article) => {
  const richEmbeds = []
  for (var e = 0; e < embeds.length; ++e) {
    const richEmbed = new Discord.RichEmbed()
    const objectEmbed = embeds[e]
    if (isStr(objectEmbed.title)) {
      const t = article.convertKeywords(objectEmbed.title)
      richEmbed.setTitle(t.length > 256 ? t.slice(0, 250) + '...' : t)
    }
    if (isStr(objectEmbed.description)) richEmbed.setDescription(article.convertKeywords(objectEmbed.description))
    if (isStr(objectEmbed.url)) richEmbed.setURL(article.convertKeywords(objectEmbed.url))
    else richEmbed.setURL(article.link)
    if (objectEmbed.color && !isNaN(objectEmbed.color) && objectEmbed.color <= 16777215 && objectEmbed.color > 0) richEmbed.setColor(parseInt(objectEmbed.color, 10))
    else if (isStr(objectEmbed.color) && objectEmbed.color.startsWith('#') && objectEmbed.color.length === 7) richEmbed.setColor(objectEmbed.color)
    if (isStr(objectEmbed['footer_text'])) richEmbed.setFooter(article.convertKeywords(objectEmbed['footer_text']), isStr(objectEmbed['footer_icon_url']) ? article.convertKeywords(objectEmbed['footer_icon_url']) : undefined)
    if (isStr(objectEmbed['author_name'])) richEmbed.setAuthor(article.convertKeywords(objectEmbed['author_name']), isStr(objectEmbed['author_icon_url']) ? article.convertKeywords(objectEmbed['author_icon_url']) : undefined, isStr(objectEmbed['author_url']) ? article.convertKeywords(objectEmbed['author_url']) : undefined)
    if (isStr(objectEmbed['thumbnail_url'])) richEmbed.setThumbnail(article.convertImgs(objectEmbed['thumbnail_url']))
    if (isStr(objectEmbed['image_url'])) richEmbed.setImage(article.convertImgs(objectEmbed['image_url']))
    if (isStr(objectEmbed.timestamp)) {
      const setting = objectEmbed.timestamp
      richEmbed.setTimestamp(setting === 'article' ? new Date(article.rawDate) : setting === 'now' ? new Date() : new Date(setting)) // No need to check for invalid date since discord.js does it
    }

    const fields = objectEmbed.fields
    if (Array.isArray(fields)) {
      for (var x = 0; x < fields.length; ++x) {
        const field = fields[x]
        const inline = field.inline === true

        let title = article.convertKeywords(field.title)
        title = title.length > 256 ? title.slice(0, 250) + '...' : title

        let value = article.convertKeywords(field.value ? field.value : '')
        value = value.length > 1024 ? value.slice(0, 1020) + '...' : value.length > 0 ? value : '\u200b'

        if (typeof title === 'string' && !title) richEmbed.addBlankField(inline)
        else if (richEmbed.fields.length < 10) richEmbed.addField(title, value, inline)
      }
    }
    richEmbeds.push(richEmbed)
  }

  return richEmbeds
}
