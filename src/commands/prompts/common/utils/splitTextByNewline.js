/**
 * @param {string} str
 */
function splitTextByNewline (fullString) {
  const split = fullString.split('\n')
  const strings = []
  let thisString = ''
  for (const str of split) {
    if (thisString.length < 1999) {
      thisString += str + '\n'
    } else {
      strings.push(thisString)
      thisString = str + '\n'
    }
  }
  if (thisString.length > 0) {
    strings.push(thisString)
  }
  return strings
}

module.exports = splitTextByNewline
