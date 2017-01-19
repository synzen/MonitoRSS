module.exports = function (text) {

  //clean up random artifacts
  var begin = text.trim()
  var a = begin.replace(/&#39;/g, "'")
          .replace(/&#32;/g, "")
          .replace(/&nbsp;/g, "")
          .replace(/&hellip;/g, "")
          .replace(/&amp;/g, "&")
          .replace(/\n\n\n/g, "\n")
          .replace(/&rsquo;/g, "'")
  //      .replace(/\n\n\n\n/g, "\n\n")

  return a

}
