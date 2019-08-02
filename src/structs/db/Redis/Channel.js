const Discord = require('discord.js')
const Base = require('./Base.js')
// const Guild = require('./Guild.js')
const promisify = require('util').promisify

class Channel extends Base {
  constructor (data, keysToFetch) {
    super(data, keysToFetch)
    this.name = ''
    this.guildID = ''
  }

  async retrieve () {
    const data = await Channel.utils.get(this.id)
    this._fetched = true
    if (!data) return
    this.exists = true
    this.name = data.name
    this.guildID = data.guildID
  }

  static get utils () {
    return {
      REDIS_KEYS: {
        channel: channelID => {
          if (!channelID) throw new TypeError('Channel ID must be provided')
          return `drss_channel_${channelID}`
        },
        channelsOfGuild: guildID => { // This is a SET. Channels of a guild that have been checked and cached
          if (!guildID) throw new TypeError(`Guild ID must be provided`)
          return `drss_guild_${guildID}_channels`
        }
      },
      JSON_KEYS: [ 'name', 'guildID' ],
      recognize: async channel => {
        if (!this.clientExists) return
        if (!(channel instanceof Discord.GuildChannel)) throw new TypeError('Channel is not instance of Discord.GuildChannel')
        if (channel.type !== 'text') return
        const toStore = {}
        this.utils.JSON_KEYS.forEach(key => {
          toStore[key] = key === 'guildID' ? channel.guild.id : channel[key] || '' // MUST be a flat structure
        })
        return new Promise((resolve, reject) => {
          this.client.multi()
            .sadd(this.utils.REDIS_KEYS.channelsOfGuild(channel.guild.id), channel.id)
            .hmset(this.utils.REDIS_KEYS.channel(channel.id), toStore)
            .exec((err, res) => err ? reject(err) : resolve(res))
        })
      },
      recognizeTransaction: (multi, channel) => {
        if (!this.clientExists) return
        if (!(channel instanceof Discord.GuildChannel)) throw new TypeError('Channel is not instance of Discord.GuildChannel')
        if (channel.type !== 'text') return
        const toStore = {}
        this.utils.JSON_KEYS.forEach(key => {
          toStore[key] = key === 'guildID' ? channel.guild.id : channel[key] || '' // MUST be a flat structure
        })
        multi
          .sadd(this.utils.REDIS_KEYS.channelsOfGuild(channel.guild.id), channel.id)
          .hmset(this.utils.REDIS_KEYS.channel(channel.id), toStore)
      },
      update: async (oldChannel, newChannel) => {
        if (!this.clientExists) return
        if (!(newChannel instanceof Discord.GuildChannel) || !(oldChannel instanceof Discord.GuildChannel)) throw new TypeError('Channel is not instance of Discord.GuildChannel')
        if (newChannel.type !== 'text') return
        // const exists = await this.utils.isChannelOfGuild(newChannel.id, newChannel.guild.id)
        // if (!exists) return Guild.utils.recognize(newChannel.guild)
        const toStore = {}
        let u = 0
        this.utils.JSON_KEYS.forEach(key => {
          if (oldChannel[key] !== newChannel[key]) {
            toStore[key] = newChannel[key] || '' // MUST be a flat structure
            ++u
          }
        })
        if (u === 0) return 0
        return promisify(this.client.hmset).bind(this.client)(this.utils.REDIS_KEYS.channel(newChannel.id), toStore)
      },
      get: async channelID => {
        if (!this.clientExists) return
        if (!channelID || typeof channelID !== 'string') throw new TypeError('channelID not a valid string')
        return promisify(this.client.hgetall).bind(this.client)(this.utils.REDIS_KEYS.channel(channelID))
      },
      getValue: async (channelID, key) => {
        if (!this.clientExists) return
        if (key !== 'name') throw new Error('Unknown key for channel:', key)
        if (!channelID || !key) throw new TypeError('channelID or key is undefined')
        return promisify(this.client.hget).bind(this.client)(this.utils.REDIS_KEYS.channel(channelID), key)
      },
      forget: async channel => {
        if (!this.clientExists) return
        if (!(channel instanceof Discord.GuildChannel)) throw new TypeError('Channel is not instance of Discord.GuildChannel')
        return new Promise((resolve, reject) => {
          this.client.multi()
            .srem(this.utils.REDIS_KEYS.channelsOfGuild(channel.guild.id), channel.id)
            .del(this.utils.REDIS_KEYS.channel(channel.id))
            .exec((err, res) => err ? reject(err) : resolve(res))
        })
      },
      forgetTransaction: (multi, channel) => {
        if (!this.clientExists) return
        if (!(channel instanceof Discord.GuildChannel)) throw new TypeError('Channel is not instance of Discord.GuildChannel')
        multi.srem(this.utils.REDIS_KEYS.channelsOfGuild(channel.guild.id), channel.id)
        multi.del(this.utils.REDIS_KEYS.channel(channel.id))
      },
      isChannelOfGuild: async (channelID, guildID) => {
        if (!this.clientExists) return
        if (!channelID || !guildID) throw new TypeError('Channel or guild ID is not defined')
        return promisify(this.client.sismember).bind(this.client)(this.utils.REDIS_KEYS.channelsOfGuild(guildID), channelID)
      },
      getChannelsOfGuild: async guildID => {
        if (!this.clientExists) return
        if (!guildID) throw new TypeError('Guild ID is not defined')
        return promisify(this.client.smembers).bind(this.client)(this.utils.REDIS_KEYS.channelsOfGuild(guildID))
      }
    }
  }
}

module.exports = Channel
