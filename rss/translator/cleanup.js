module.exports = function (text) {

  //clean up random artifacts
  var begin = text.trim()
  var a = begin.replace(/&#39;/g, "'")
  var b = a.replace(/&#32;/g, "")
  var c = b.replace(/&nbsp;/g, "")
  var d = c.replace(/&hellip;/g, "")
  var e = d.replace(/&amp;/g, "&")
  var f = e.replace(/\n\n\n/g, "\n")
  //var g = f.replace(/\n\n\n\n/g, "\n\n")

  return f

}
