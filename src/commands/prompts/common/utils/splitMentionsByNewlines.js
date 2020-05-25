/**
  * @param {string[]} mentionStrings
  */
function splitMentionsByNewlines (mentionStrings) {
  const ordered = mentionStrings.sort((a, b) => {
    return a.toLowerCase() < b.toLowerCase() ? -1 : 1
  })
  // Put 10 mentions on new lines so message splitting work properly
  const outputMentionArrs = []
  for (const substring of ordered) {
    const lastArray = outputMentionArrs[outputMentionArrs.length - 1]
    if (!lastArray || lastArray.length === 10) {
      outputMentionArrs.push([substring])
    } else {
      lastArray.push(substring)
    }
  }
  return outputMentionArrs.map(arr => arr.join(' ')).join('\n')
}

module.exports = splitMentionsByNewlines
