const cleanEntities = require('entities')

module.exports = function (text) {
  //clean up random artifacts
  var begin = text.trim()
  var a = cleanEntities.decodeHTML(text).replace(/\n\n\n/g, "\n")
  return a

}
