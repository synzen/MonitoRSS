import textParser from '../components/ControlPanel/utils/textParser'
import keywordExtractor from 'keyword-extractor'
import stemmer from 'stemmer'

const content = [
  {
    q: 'Why are no articles coming in and being delivered for my feed?',
    a: `Double check that D.RSS has permissions to read and send messages.

    Make sure the all feed's contents and articles are publicly accessible (for example, not in private forum sections)
    
    Wait at at least 10 minutes for any new articles to be fetched, if there are any past the time of feed addition (which can be checked in a browser that beautifies the feed such as firefox, or a browser plugin).
    
    If still nothing by then, make sure the feed you're trying to add has the pubdate (published date) and \`{date}\` field in rsstest filled out. If they don't exist, it will be marked as old and won't be sent. You may bypass this by disabling date checks for a specific feed in rssoptions #4.
    
    If date checks are turned on (which is default), make sure articles \`{date}\` are less than a day old.`,
    t: ['missing', 'articles', 'missing', 'feed', 'no articles']
  },
  {
    q: 'Why am I getting "(Connection failed) Bad Cloudflare status code (503). Unsupported on public bot"?',
    a: 'Support for Cloudflare feeds has been removed on the public bot to reduce fetch timese for the greater good of everyone else.',
    t: ['cloudflare', 'status code', 'connection failed']
  },
  {
    q: 'Why am I getting duplicate articles with the same title?',
    a: 'The feed author may be improperly formatting the feed, causing two same articles to have the different unique identifiers (commonly guid) and thus classified as different articles. You may work around this by enabling title checks via ~rssoptions.',
    t: ['duplicate', 'same title', 'repeat']
  },
  {
    q: 'How do I restore an rssbackup file?',
    a: `If you're on the public bot, DM me your file. Otherwise, use the restore bot controller command.`,
    t: ['rssbackup', 'restore']
  },
  {
    q: 'What permissions does someone need to use the bot?',
    a: `Manage Channel permission in either Server Settings, or in a specific channel's settings.`,
    t: ['permission', 'command']
  },
  {
    q: 'How do I get higher feed limit or faster refresh rate?',
    a: `You may get an official limit increase that supports customizations for each individual feed by supporting me on Patreon https://www.patreon.com/discordrss (would be greatly appreciated!).
    
    You may also use a feed aggregator to combine multiple feeds into one (this has some disadvantages, such as its own unknown refresh time separate from the bot's). The limit is there to prevent abuse, and to optimize retrieval times.`,
    t: ['feed limit', 'increase', 'refresh rate', 'more feeds']
  },
  {
    q: 'How do I give a custom name and avatar to the bot?',
    a: `For a custom name, you can set its nickname by right click and change nickname. If you want a custom avatar, this can only be done via webhooks (https://github.com/synzen/Discord.RSS/wiki/Webhook-Integration). For use of webhooks on the public bot, you will need to be a patron (https://www.patreon.com/discordrss).`,
    t: ['custom name', 'custom avatar', 'webhook']
  },
  {
    q: 'How do I get the content in a tag in the original XML feed source that is not available as a placeholder?',
    a: `Use rssdump to get a list of all possible "raw" placeholders, and refer to them as \`{raw:placeholder_name}\` in your message or filters. Replace \`placeholder_name\` with the name in the rssdump file.`,
    t: ['rssdump', 'raw placeholder', 'xml', 'source', 'tag']
  }
]

const invertedIndexes = {}
const extractorOptions = { remove_digits: true, remove_duplicates: false, return_changed_case: true }
const TAG_POINTS = 5
const QUESTION_POINTS = 3
const ANSWER_POINTS = 1

content.forEach((item, contentIndex) => {
  // First get the words
  // Question
  const keywords = item.q.split(' ').map(stemmer)
  for (const word of keywords) {
    if (!invertedIndexes[word]) {
      invertedIndexes[word] = []
      invertedIndexes[word][contentIndex] = [contentIndex, QUESTION_POINTS]
    } else if (!invertedIndexes[word][contentIndex]) {
      invertedIndexes[word][contentIndex] = [contentIndex, QUESTION_POINTS]
    } else {
      invertedIndexes[word][contentIndex][1] += QUESTION_POINTS
    }
  }

  // Answer
  const answerKeywords = keywordExtractor.extract(item.a, extractorOptions).map(stemmer)
  for (const word of answerKeywords) {
    if (!invertedIndexes[word]) {
      invertedIndexes[word] = []
      invertedIndexes[word][contentIndex] = [contentIndex, ANSWER_POINTS]
    } else if (!invertedIndexes[word][contentIndex]) {
      invertedIndexes[word][contentIndex] = [contentIndex, ANSWER_POINTS]
    } else {
      invertedIndexes[word][contentIndex][1] += ANSWER_POINTS
    }
  }

  // Tags. Give half points for each word if it's a multi-word tag
  const halfTags = []
  const tags = []
  item.t.forEach(item => {
    tags.push(stemmer(item))
    const splat = item.split(' ')
    if (splat.length > 1) {
      splat.forEach(halfTag => halfTags.push(stemmer(halfTag)))
    }
  })
  const bothTags = [ halfTags, tags ]
  for (let i = 0; i < bothTags.length; ++i) {
    const POINTS = i === 0 ? TAG_POINTS / 2 : TAG_POINTS
    const tags = bothTags[i]
    for (const word of tags) {
      if (!invertedIndexes[word]) {
        invertedIndexes[word] = []
        invertedIndexes[word][contentIndex] = [contentIndex, POINTS]
      } else if (!invertedIndexes[word][contentIndex]) {
        invertedIndexes[word][contentIndex] = [contentIndex, POINTS]
      } else {
        invertedIndexes[word][contentIndex][1] += POINTS
      }
    }
  }

  item.qe = item.q.replace(/\s/g, '-').replace(/\?/g, '')
  item.a = textParser.parseAllowLinks(item.a)
})

for (const word in invertedIndexes) {
  const invertedIndex = invertedIndexes[word]
  invertedIndexes[word] = invertedIndex.filter(item => item)
}

console.log(invertedIndexes)
export { content as faq, invertedIndexes }
