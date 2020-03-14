const Discord = require('discord.js')
const Base = require('./Base.js')
const promisify = require('util').promisify

class User extends Base {
  constructor (id, keysToFetch) {
    super(id, keysToFetch)
    this.username = ''
    this.displayAvatarURL = ''
    this.discriminator = ''
  }

  async retrieve () {
    const data = await User.utils.get(this.id)
    this._fetched = true
    if (!data) return
    this.exists = true
    this.username = data.username
    this.displayAvatarURL = data.displayAvatarURL
    this.discriminator = data.discriminator
  }

  static get utils () {
    return {
      REDIS_KEYS: {
        user: userId => { // This is a HASH. Users with their data that have been cached.
          if (!userId) throw new TypeError(`User ID must be provided`)
          return `drss_user_${userId}`
        }
      },
      JSON_KEYS: ['username', 'displayAvatarURL', 'discriminator', 'id'],
      recognize: async user => {
        if (!this.clientExists) return
        if (!(user instanceof Discord.User)) throw new TypeError('User is not instance of Discord.User')
        const toStore = {}
        this.utils.JSON_KEYS.forEach(key => {
          // MUST be a flat structure
          if (key === 'displayAvatarURL') {
            toStore[key] = user[key]() || ''
          } else {
            toStore[key] = user[key] || ''
          }
        })
        return promisify(this.client.hmset).bind(this.client)(this.utils.REDIS_KEYS.user(user.id), toStore)
      },
      update: async (oldUser, newUser) => {
        if (!this.clientExists) return
        if (!(oldUser instanceof Discord.User) || !(newUser instanceof Discord.User)) throw new TypeError('User is not instance of Discord.User')
        const exists = await promisify(this.client.exists).bind(this.client)(this.utils.REDIS_KEYS.user(newUser.id))
        if (!exists) return exports.guilds.recognize(newUser)
        const toStore = {}
        this.utils.JSON_KEYS.forEach(key => {
          if (key === 'displayAvatarURL') {
            const oldAvatar = oldUser[key]()
            const newAvatar = newUser[key]()
            if (oldAvatar !== newAvatar) {
              toStore[key] = newAvatar
            }
          } else if (newUser[key] !== oldUser[key]) {
            toStore[key] = newUser[key]
          }
        })
        if (Object.keys(toStore).length === 0) {
          return 0
        }
        const promises = []
        for (const key in toStore) {
          const val = toStore[key]
          promises.push(promisify(this.client.hset).bind(this.client)(this.utils.REDIS_KEYS.user(newUser.id), key, val))
        }
        await Promise.all(promises)
      },
      get: async userId => {
        if (!this.clientExists) return
        if (!userId || typeof userId !== 'string') throw new TypeError('userId not a valid string')
        return promisify(this.client.hgetall).bind(this.client)(this.utils.REDIS_KEYS.user(userId))
      },
      getValue: async (userId, key) => {
        if (!this.clientExists) return
        if (!this.utils.JSON_KEYS.includes(key)) throw new Error('Unknown key for role:', key)
        if (!userId || !key) throw new TypeError('userId or key is undefined')
        return promisify(this.client.hget).bind(this.client)(this.utils.REDIS_KEYS.user(userId), key)
      }
    }
  }
}

module.exports = User
