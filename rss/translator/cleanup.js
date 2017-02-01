const cleanEntities = require('entities')
const striptags = require('striptags')

module.exports = function (text) {

  var a = cleanEntities.decodeHTML(text)
          .replace(/<br>/g, "\n")
          .replace(/<br \/>/g, "\n")
          .replace(/\r\n/g, "\n")
          .replace(/\s\n/g, "\n")
          .replace(/\n /g, "\n")
          .replace(/ \n/g, "\n")
          // .replace(/\n\s/g,"\n")
          .replace(/\n\n\n\n/g, "\n\n")

  return striptags(a).trim()

}
