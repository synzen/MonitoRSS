/**
  * @param {string[]} mentionStrings
  */
function splitMentionsByNewlines (mentionStrings) {
  // Put 10 mentions on new lines so message splitting work properly
  const outputMentionArrs = []
  for (const substring of mentionStrings) {
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
