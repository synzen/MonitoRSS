const log = require('../util/logger.js')
const Discord = require('discord.js')
const FeedSelector = require('../structs/FeedSelector.js')
const FlattenedJSON = require('../structs/FlattenedJSON.js')
const getArticle = require('../rss/getArticle.js')

module.exports = (bot, message, command) => {
  const feedSelector = new FeedSelector(message, undefined, { command: command })
  feedSelector.send(undefined, async (err, data, msgHandler) => {
    try {
      if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
      const wait = await message.channel.send(`Generating dump...`)
      getArticle(data.guildRss, data.rssName, false, (err, article, linkList, articleList) => {
        if (err) {
          let channelErrMsg = ''
          switch (err.type) {
            case 'failedLink':
              channelErrMsg = 'Reached fail limit. Use `rssrefresh` to try to validate and refresh feed'
              break
            case 'request':
              channelErrMsg = 'Unable to connect to feed link'
              break
            case 'feedparser':
              channelErrMsg = 'Invalid feed'
              break
            case 'database':
              channelErrMsg = 'Internal database error. Try again'
              break
            case 'deleted':
              channelErrMsg = 'Feed missing from database'
              break
            case 'empty':
              channelErrMsg = 'No existing articles'
              break
            default:
              channelErrMsg = 'No reason available'
          }
          log.command.warning(`Unable to generate rssdump for ${err.feed.link}`, message.guild, err)
          msgHandler.deleteAll(message.channel)
          return wait.edit(`Unable to generate dump for <${err.feed.link}>. (${channelErrMsg})`).catch(err => log.command.warning(`rssdump 1`, message.guild, err))
        }
        let textOutput = ''
        let objOutput = []
        const raw = message.content.split(' ')[1] === 'original'
        for (var link in articleList) {
          const articleObject = articleList[link]
          if (raw) objOutput.push(articleObject)
          else {
            const textified = new FlattenedJSON(articleObject, data.guildRss.sources[data.rssName])
            textOutput += textified.text + '\r\n\r\n'
          }
        }
        textOutput = textOutput.trim()
        msgHandler.deleteAll()
        wait.edit('Dump has been generated. See below.').catch(err => log.comamnd.warning('rssdump 2', message.guild, err))
        message.channel.send('', new Discord.Attachment(Buffer.from(raw ? JSON.stringify(objOutput, null, 2) : textOutput), raw ? `${link}.json` : `${link}.txt`)).catch(err => {
          log.comamnd.warning('rssdump 3', message.guild, err)
          wait.edit('Unable to send dump file.', err.message).catch(err => log.command.warning('rssdump 4', message.guild, err))
        })
      })
    } catch (err) {
      log.command.warning(`rssdump`, message.guild, err)
    }
  })
}
