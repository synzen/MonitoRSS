const Discord = require('discord.js')
const Base = require('./Base.js')
const promisify = require('util').promisify

class Role extends Base {
  constructor (id, keysToFetch) {
    super(id, keysToFetch)
    this.guildID = ''
    this.name = ''
    this.hexColor = ''
    this.position = -1
    this.isManager = false
  }

  async retrieve () {
    const data = await Role.utils.get(this.id)
    this._fetched = true
    if (!data) return
    this.exists = true
    this.name = data.name
    this.hexColor = data.hexColor
    this.position = +data.position // Convert to number
    this.guildID = data.guildID
    const isManager = await Role.utils.isManagerOfGuild(this.id, this.guildID)
    this.isManager = isManager
  }

  static get utils () {
    return {
      REDIS_KEYS: {
        role: roleID => {
          if (!roleID) throw new TypeError(`Role ID must be provided`)
          return `drss_role_${roleID}`
        },
        rolesOfGuild: guildID => { // This is a SET.
          if (!guildID) throw new TypeError(`Guild ID must be provided`)
          return `drss_guild_${guildID}_roles`
        },
        managerRolesOfGuild: guildID => {
          if (!guildID) throw new TypeError(`Guild ID must be provided`)
          return `drss_guild_${guildID}_roles_managers`
        }
      },
      JSON_KEYS: ['id', 'guildID', 'name', 'hexColor', 'position'],
      recognize: async role => {
        if (!this.clientExists) return
        if (!(role instanceof Discord.Role)) throw new TypeError('Role is not instance of Discord.Role')
        const toStore = {}
        this.utils.JSON_KEYS.forEach(key => {
          toStore[key] = key === 'guildID' ? role.guild.id : role[key] === undefined ? '' : role[key] // Check of undefined explicitly since a falsy check will erroneously trigger for a value of 0 for role.position
        })
        return new Promise((resolve, reject) => {
          this.client.multi()
            .sadd(this.utils.REDIS_KEYS.rolesOfGuild(role.guild.id), role.id)
            .sadd(this.utils.REDIS_KEYS.managerRolesOfGuild(role.guild.id), role.id)
            .hmset(this.utils.REDIS_KEYS.role(role.id), toStore)
            .exec((err, res) => err ? reject(err) : resolve(res))
        })
      },
      recognizeTransaction: (multi, role) => {
        if (!this.clientExists) return
        if (!(role instanceof Discord.Role)) throw new TypeError('Role is not instance of Discord.Role')
        const toStore = {}
        this.utils.JSON_KEYS.forEach(key => {
          toStore[key] = key === 'guildID' ? role.guild.id : role[key] === undefined ? '' : role[key]
        })
        multi
          .sadd(this.utils.REDIS_KEYS.rolesOfGuild(role.guild.id), role.id)
          .sadd(this.utils.REDIS_KEYS.managerRolesOfGuild(role.guild.id), role.id)
          .hmset(this.utils.REDIS_KEYS.role(role.id), toStore)
      },
      update: async (oldRole, newRole) => {
        if (!this.clientExists) return
        if (!(oldRole instanceof Discord.Role) || !(newRole instanceof Discord.Role)) throw new TypeError('Role is not instance of Discord.Role')
        const exists = await promisify(this.client.exists).bind(this.client)(this.utils.REDIS_KEYS.role(newRole.id))
        if (!exists) return this.utils.recognize(newRole)
        const toStore = {}
        let u = 0
        this.utils.JSON_KEYS.forEach(key => {
          if (newRole[key] !== oldRole[key]) {
            toStore[key] = newRole[key] === undefined ? '' : newRole[key]
            ++u
          }
        })
        if (u === 0) return 0
        return promisify(this.client.hmset).bind(this.client)(this.utils.REDIS_KEYS.role(newRole.id), toStore)
      },
      forget: async role => {
        if (!this.clientExists) return
        if (!(role instanceof Discord.Role)) throw new TypeError('Role is not instance of Discord.Role')
        return new Promise((resolve, reject) => {
          this.client.multi()
            .srem(this.utils.REDIS_KEYS.rolesOfGuild(role.guild.id), role.id)
            .srem(this.utils.REDIS_KEYS.managerRolesOfGuild(role.guild.id), role.id)
            .del(this.utils.REDIS_KEYS.role(role.id))
            .exec((err, res) => err ? reject(err) : resolve(res))
        })
      },
      recognizeManager: async role => {
        if (!this.clientExists) return
        if (!(role instanceof Discord.Role)) throw new TypeError('Role is not instance of Discord.Role')
        return promisify(this.client.sadd).bind(this.client)(this.utils.REDIS_KEYS.managerRolesOfGuild(role.guild.id), role.id)
      },
      forgetManager: async role => {
        if (!this.clientExists) return
        if (!(role instanceof Discord.Role)) throw new TypeError('Role is not instance of Discord.Role')
        return promisify(this.client.srem).bind(this.client)(this.utils.REDIS_KEYS.managerRolesOfGuild(role.guild.id), role.id)
      },
      forgetTransaction: (multi, role) => {
        if (!this.clientExists) return
        if (!(role instanceof Discord.Role)) throw new TypeError('Member is not instance of Discord.Role')
        multi
          .srem(this.utils.REDIS_KEYS.rolesOfGuild(role.guild.id), role.id)
          .srem(this.utils.REDIS_KEYS.managerRolesOfGuild(role.guild.id), role.id)
          .del(this.utils.REDIS_KEYS.role(role.id))
      },
      isRoleOfGuild: async (roleID, guildID) => {
        if (!this.clientExists) return
        if (!roleID || !guildID) throw new TypeError('Role or guild ID is not defined')
        return promisify(this.client.sismember).bind(this.client)(this.utils.REDIS_KEYS.rolesOfGuild(guildID), roleID)
      },
      isManagerOfGuild: async (roleID, guildID) => {
        if (!this.clientExists) return
        if (!roleID || !guildID) throw new TypeError('Role or guild ID is not defined')
        return promisify(this.client.sismember).bind(this.client)(this.utils.REDIS_KEYS.managerRolesOfGuild(guildID), roleID)
      },
      get: async roleID => {
        if (!this.clientExists) return
        if (!roleID || typeof roleID !== 'string') throw new TypeError('roleID not a valid string')
        return promisify(this.client.hgetall).bind(this.client)(this.utils.REDIS_KEYS.role(roleID))
      },
      getValue: async (roleID, key) => {
        if (!this.clientExists) return
        if (!this.utils.JSON_KEYS.includes(key)) throw new Error('Unknown key for role:', key)
        if (!roleID || !key) throw new TypeError('roleID or key is undefined')
        return promisify(this.client.hget).bind(this.client)(this.utils.REDIS_KEYS.role(roleID), key)
      },
      getRolesOfGuild: async guildID => {
        if (!this.clientExists) return
        if (!guildID) throw new TypeError('Guild ID is not defined')
        return promisify(this.client.smembers).bind(this.client)(this.utils.REDIS_KEYS.rolesOfGuild(guildID))
      }
    }
  }
}

module.exports = Role
