const cleanEntities = require('entities')

module.exports = function (text) {
  //clean up random artifacts
  var a = cleanEntities.decodeHTML(text)
          .replace(/\r\n/g, "\n")
          .replace(/\s\n/g, "\n")
          .replace(/\n\s/g,"\n")
          .replace(/\n\n\n\n/g, "\n\n")

  return a.trim()

}
