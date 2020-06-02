const Discord = require('discord.js')
const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const FeedFetcher = require('../../../util/FeedFetcher.js')
const FlattenedJSON = require('../../../structs/FlattenedJSON.js')
const URL = require('url').URL

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {boolean} raw
 */

/**
 * @param {Data} data
 */
async function sendFileVisual (data) {
  const { selectedFeed: feed, raw } = data
  const { articleList } = await FeedFetcher.fetchFeed(feed.url)
  let textOutput = ''
  const objOutput = []
  for (var articleObject of articleList) {
    if (raw) {
      objOutput.push(articleObject)
    } else {
      textOutput += new FlattenedJSON(articleObject, feed).text + '\r\n\r\n'
    }
  }
  textOutput = textOutput.trim()
  const bufferData = Buffer.from(raw ? JSON.stringify(objOutput, null, 2) : textOutput)
  const domain = new URL(feed.url).hostname
  const fileName = raw ? `${domain}.json` : `${domain}.txt`
  return new MessageVisual('', {
    files: [
      new Discord.MessageAttachment(bufferData, fileName)
    ]
  })
}

const prompt = new LocalizedPrompt(sendFileVisual)

exports.prompt = prompt
