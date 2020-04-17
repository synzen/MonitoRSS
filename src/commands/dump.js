const Discord = require('discord.js')
const FlattenedJSON = require('../structs/FlattenedJSON.js')
const FeedFetcher = require('../util/FeedFetcher.js')
const Translator = require('../structs/Translator.js')
const { PromptNode } = require('discord.js-prompts')
const commonPrompts = require('./prompts/common/index.js')
const runWithFeedGuild = require('./prompts/runner/runWithFeedsProfile.js')

module.exports = async (message, command) => {
  const selectFeedNode = new PromptNode(commonPrompts.selectFeed.prompt)
  const { selectedFeed: feed, profile } = await runWithFeedGuild(selectFeedNode, message)
  const guildLocale = profile ? profile.locale : undefined
  if (!feed) {
    return
  }
  const translate = Translator.createLocaleTranslator(guildLocale)
  const wait = await message.channel.send(translate('commands.dump.generatingDump'))
  const url = feed.url
  const { articleList } = await FeedFetcher.fetchFeed(url)
  let textOutput = ''
  const objOutput = []
  const raw = message.content.split(' ')[1] === 'original'
  for (var articleObject of articleList) {
    if (raw) objOutput.push(articleObject)
    else textOutput += new FlattenedJSON(articleObject, feed).text + '\r\n\r\n'
  }
  textOutput = textOutput.trim()
  await wait.edit(translate('commands.dump.generatedDump'))
  const bufferData = Buffer.from(raw ? JSON.stringify(objOutput, null, 2) : textOutput)
  await message.channel.send('', new Discord.MessageAttachment(bufferData, raw ? `${url}.json` : `${url}.txt`))
}
