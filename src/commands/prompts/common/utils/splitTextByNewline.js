/**
 * @param {string} str
 */
function splitTextByNewline (fullString, maxLength = 1999) {
  const split = fullString.split('\n')
  const strings = []
  let thisString = ''
  for (const str of split) {
    // Plus 1 for the newline
    if (thisString.length + str.length + 1 < maxLength) {
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
