

module.exports = function (text) {

  //clean up random artifacts
  var a = text.replace(/&#39;/g, "'")
  var b = a.replace(/&#32;/g, "")
  var c = b.replace(/&nbsp;/g, "")
  var d = c.replace(/&hellip;/g, "")
  var e = d.replace(/&lt;3/g, "")
  
  return e.trim()

}
