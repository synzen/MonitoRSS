const fileOps = require('../util/fileOps.js')
const config = require('../config.json')
const storage = require('../util/storage.js')
const webhookAccessors = storage.webhookAccessors
const MenuUtils = require('./util/MenuUtils.js')
const FeedSelector = require('./util/FeedSelector.js')

async function feedSelectorFn (m, data, callback) {
  const { guildRss, rssName } = data
  const existingWebhook = guildRss.sources[rssName].webhook

  const text = `${typeof existingWebhook === 'object' ? 'An existing webhook was found (' + existingWebhook.name + '). You may type `{remove}` to disconnect the existing webhook, or continue and your new setting will overwrite the existing one.\n' : ''}
Type the name of the webhook in this channel you wish to use (case sensitive), or type \`exit\` to cancel.\n
To use a different name or avatar url of the webhook when articles are sent for this particular feed, add parameters \`--name="my new name here"\` or \`--avatar="http://website.com/image.jpg"\``

  callback(null, { ...data,
    existingWebhook: existingWebhook,
    next: {
      text: text,
      embed: null
    }})
}

function collectWebhook (m, data, callback) {
  const { hooks } = data
  const webhookName = m.content
  if (webhookName === '{remove}') return callback(null, { ...data, webhookName: webhookName })

  const nameRegex = /--name="(((?!(--name|--avatar)).)*)"/
  const avatarRegex = /--avatar="(((?!(--name|--avatar)).)*)"/
  const hookName = m.content.replace(nameRegex, '').replace(avatarRegex, '').trim()
  const hook = hooks.find('name', hookName)
  if (!hook) return callback(new SyntaxError(`No such webhook named "${hookName}" found for this channel. Try again, or type \`exit\` to cancel.`))
  let customNameSrch = m.content.match(nameRegex)
  let customAvatarSrch = m.content.match(avatarRegex)

  if (customNameSrch) customNameSrch = customNameSrch[1]
  if (customAvatarSrch) customAvatarSrch = customAvatarSrch[1]
  callback(null, { ...data, webhook: hook, customAvatarSrch: customAvatarSrch, customNameSrch: customNameSrch })
}

module.exports = async (bot, message, command) => {
  try {
    if (config.advanced.restrictWebhooks === true && !webhookAccessors.ids.includes(message.guild.id)) {
      console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => User "${message.author.username}" attempted to access webhooks as an unauthorized user`)
      return await message.channel.send(`This server does not have access to webhook use.`)
    }
    if (!message.guild.me.permissionsIn(message.channel).has('MANAGE_WEBHOOKS')) return await message.channel.send(`I must have Manage Webhooks permission in this channel in order to work.`)

    const hooks = await message.channel.fetchWebhooks()
    const feedSelector = new FeedSelector(message, feedSelectorFn, { command: command })
    const webhookSelector = new MenuUtils.Menu(message, collectWebhook)

    new MenuUtils.MenuSeries(message, [feedSelector, webhookSelector], { hooks: hooks }).start(async (err, data) => {
      try {
        if (err) return err.code === 50013 ? null : await message.channel.send(err.message)
        const { guildRss, rssName, existingWebhook, webhookName, webhook, customAvatarSrch, customNameSrch } = data
        const source = guildRss.sources[rssName]
        if (webhookName === '{remove}') {
          console.log('here')
          if (typeof existingWebhook !== 'object') await message.channel.send(`There is no webhook assigned to this feed.`)
          else {
            const name = source.webhook.name
            delete source.webhook
            await message.channel.send(`Successfully removed webhook ${name} from the feed <${source.link}>.`)
          }
        } else {
          source.webhook = {
            id: webhook.id,
            name: webhook.name
          }

          if (customNameSrch) source.webhook.name = customNameSrch
          if (customAvatarSrch) source.webhook.avatar = customAvatarSrch
          await webhook.send(`I am now connected to ${bot.user}, and will send feed articles for <${source.link}>!`, { username: customNameSrch, avatarURL: customAvatarSrch })
        }
        fileOps.updateFile(guildRss)
      } catch (err) {
        console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => rsswebhook2:`, err.message || err)
        if (err.code !== 50013) message.channel.send('Unable to fetch webhooks for this channel. ', err.message).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => rsswebhook 2:`, err.message || err))
      }
    })
  } catch (err) {
    console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => rsswebhook1:`, err.message || err)
  }
}
