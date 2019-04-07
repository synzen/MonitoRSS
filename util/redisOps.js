const storage = require('./storage.js')
const Discord = require('discord.js')
const promisify = require('util').promisify
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'

exports.client = {
  exists: () => !!storage.redisClient
}

exports.guilds = {
  STORED_KEYS: [ 'name', 'iconURL', 'ownerID' ],
  recognize: async guild => {
    if (!storage.redisClient) return
    if (!(guild instanceof Discord.Guild)) throw new TypeError('Guild is not instance of Discord.Guild')
    const multi = storage.redisClient.multi()
    const toStore = {}
    exports.guilds.STORED_KEYS.forEach(key => {
      toStore[key] = guild[key] || '' // MUST be a flat structure
    })
    multi.hmset(storage.redisKeys.guilds(guild.id), toStore)
    guild.members.forEach(member => exports.members.recognizeTransaction(multi, member))
    guild.channels.forEach(channel => exports.channels.recognizeTransaction(multi, channel))
    guild.roles.forEach(role => exports.roles.recognizeTransaction(multi, role))
    return new Promise((resolve, reject) => multi.exec((err, res) => err ? reject(err) : resolve(res)))
  },
  update: async (oldGuild, newGuild) => {
    if (!storage.redisClient) return
    if (!(oldGuild instanceof Discord.Guild) || !(newGuild instanceof Discord.Guild)) throw new TypeError('Guild is not instance of Discord.Guild')
    const exists = await promisify(storage.redisClient.exists).bind(storage.redisClient)(storage.redisKeys.guilds(newGuild.id))
    if (!exists) await exports.guilds.recognize(newGuild)
    else {
      const toStore = {}
      exports.guilds.STORED_KEYS.forEach(key => {
        if (newGuild[key] !== oldGuild[key]) toStore[key] = newGuild[key] || ''
      })
      if (Object.keys(toStore).length > 0) return promisify(storage.redisClient.hmset).bind(storage.redisClient)(storage.redisKeys.guilds(newGuild.id), toStore)
      else return 0
    }
  },
  forget: async guild => {
    if (!storage.redisClient) return
    if (!(guild instanceof Discord.Guild)) throw new TypeError('Guild is not instance of Discord.Guild')
    const multi = storage.redisClient.multi()
    multi.del(storage.redisKeys.guilds(guild.id))
    guild.members.forEach(member => exports.members.forgetTransaction(multi, member))
    guild.channels.forEach(channel => exports.channels.forgetTransaction(multi, channel))
    guild.roles.forEach(role => exports.roles.forgetTransaction(multi, role))
    return new Promise((resolve, reject) => multi.exec((err, res) => err ? reject(err) : resolve(res)))
  },
  get: async guildId => {
    if (!storage.redisClient) return
    if (!guildId || typeof guildId !== 'string') throw new TypeError('guildId not a valid string')
    return promisify(storage.redisClient.hgetall).bind(storage.redisClient)(storage.redisKeys.guilds(guildId))
  },
  getValue: async (guildId, key) => {
    if (!storage.redisClient) return
    if (!exports.guilds.STORED_KEYS.includes(key)) throw new Error('Unknown key for guild:', key)
    if (!guildId || !key) throw new TypeError('guildId or key is undefined')
    return promisify(storage.redisClient.hget).bind(storage.redisClient)(storage.redisKeys.guilds(guildId), key)
  },
  exists: async guildId => {
    if (!storage.redisClient) return
    if (!guildId || typeof guildId !== 'string') throw new TypeError('guildId not a valid string')
    return promisify(storage.redisClient.exists).bind(storage.redisClient)(storage.redisKeys.guilds(guildId))
  }
}

exports.members = {
  recognize: async member => {
    if (!storage.redisClient) return
    if (!(member instanceof Discord.GuildMember)) throw new TypeError('Member is not instance of Discord.GuildMember')
    const result = await promisify(storage.redisClient.sadd).bind(storage.redisClient)(storage.redisKeys.guildMembersOf(member.guild.id), member.id)
    if (member.hasPermission(MANAGE_CHANNELS_PERM)) return exports.members.addManager(member.guild)
    else return result
  },
  recognizeTransaction: (multi, member) => {
    if (!storage.redisClient) return
    if (!(member instanceof Discord.GuildMember)) throw new TypeError('Member is not instance of Discord.GuildMember')
    multi.sadd(storage.redisKeys.guildMembersOf(member.guild.id), member.id)
    if (member.hasPermission(MANAGE_CHANNELS_PERM)) multi.sadd(storage.redisKeys.guildManagersOf(member.guild.id), member.id)
  },
  addManager: async member => {
    if (!storage.redisClient) return
    if (!(member instanceof Discord.GuildMember)) throw new TypeError('Member is not instance of Discord.GuildMember')
    return promisify(storage.redisClient.sadd).bind(storage.redisClient)(storage.redisKeys.guildManagersOf(member.guild.id), member.id)
  },
  addManagerManual: async (userId, guildId) => {
    // This does not add to the regular members set of the guild
    if (!storage.redisClient) return
    if (!userId || !guildId) throw new TypeError('User or guild ID is not defined')
    return promisify(storage.redisClient.sadd).bind(storage.redisClient)(storage.redisKeys.guildManagersOf(guildId), userId)
  },
  removeManager: async member => {
    if (!storage.redisClient) return
    if (!(member instanceof Discord.GuildMember)) throw new TypeError('Member is not instance of Discord.GuildMember')
    return promisify(storage.redisClient.srem).bind(storage.redisClient)(storage.redisKeys.guildManagersOf(member.guild.id), member.id)
  },
  addNonManager: async (userId, guildId) => {
    if (!storage.redisClient) return
    if (!userId || !guildId) throw new TypeError('User or guild ID is not defined')
    return promisify(storage.redisClient.sadd).bind(storage.redisClient)(storage.redisKeys.notGuildManagersOf(guildId), userId)
  },
  forget: async member => {
    if (!storage.redisClient) return
    if (!(member instanceof Discord.GuildMember)) throw new TypeError('Member is not instance of Discord.GuildMember')
    return new Promise((resolve, reject) => {
      storage.redisClient.multi()
        .srem(storage.redisKeys.guildMembersOf(member.guild.id), member.id)
        .srem(storage.redisKeys.guildManagersOf(member.guild.id), member.id)
        .exec((err, res) => err ? reject(err) : resolve(res))
    })
  },
  forgetTransaction: (multi, member) => {
    if (!storage.redisClient) return
    if (!(member instanceof Discord.GuildMember)) throw new TypeError('Member is not instance of Discord.GuildMember')
    multi.srem(storage.redisKeys.guildMembersOf(member.guild.id), member.id)
    multi.srem(storage.redisKeys.guildManagersOf(member.guild.id), member.id)
  },
  isMemberOfGuild: async (userId, guildId) => {
    if (!storage.redisClient) return
    if (!userId || !guildId) throw new TypeError('User or guild ID is not defined')
    return promisify(storage.redisClient.sismember).bind(storage.redisClient)(storage.redisKeys.guildMembersOf(guildId), userId)
  },
  isManagerOfGuild: async (userId, guildId) => {
    if (!storage.redisClient) return
    if (!userId || !guildId) throw new TypeError('User or guild ID is not defined')
    return promisify(storage.redisClient.sismember).bind(storage.redisClient)(storage.redisKeys.guildManagersOf(guildId), userId)
  },
  isNotManagerOfGuild: async (userId, guildId) => {
    if (!storage.redisClient) return
    if (!userId || !guildId) throw new TypeError('User or guild ID is not defined')
    return promisify(storage.redisClient.sismember).bind(storage.redisClient)(storage.redisKeys.notGuildManagersOf(guildId), userId)
  }
}

exports.channels = {
  recognize: async channel => {
    if (!storage.redisClient) return
    if (!(channel instanceof Discord.GuildChannel)) throw new TypeError('Channel is not instance of Discord.GuildChannel')
    if (channel.type !== 'text') return
    return new Promise((resolve, reject) => {
      storage.redisClient.multi()
        .sadd(storage.redisKeys.guildChannelsOf(channel.guild.id), channel.id)
        .hmset(storage.redisKeys.channelNames(), channel.id, channel.name)
        .exec((err, res) => err ? reject(err) : resolve(res))
    })
  },
  recognizeTransaction: (multi, channel) => {
    if (!storage.redisClient) return
    if (!(channel instanceof Discord.GuildChannel)) throw new TypeError('Channel is not instance of Discord.GuildChannel')
    if (channel.type !== 'text') return
    multi
      .sadd(storage.redisKeys.guildChannelsOf(channel.guild.id), channel.id)
      .hmset(storage.redisKeys.channelNames(), channel.id, channel.name)
  },
  updateName: async channel => {
    if (!storage.redisClient) return
    if (!(channel instanceof Discord.GuildChannel)) throw new TypeError('Channel is not instance of Discord.GuildChannel')
    if (channel.type !== 'text') return
    const exists = await exports.channels.isChannelOfGuild(channel.id, channel.guild.id)
    if (!exists) return exports.guilds.recognize(channel.guild)
    else return promisify(storage.redisClient.hset).bind(storage.redisClient)(storage.redisKeys.channelNames(), channel.id, channel.name)
  },
  forget: async channel => {
    if (!storage.redisClient) return
    if (!(channel instanceof Discord.GuildChannel)) throw new TypeError('Channel is not instance of Discord.GuildChannel')
    return new Promise((resolve, reject) => {
      storage.redisClient.multi()
        .srem(storage.redisKeys.guildChannelsOf(channel.guild.id), channel.id)
        .hdel(storage.redisKeys.channelNames(channel.guild.id), channel.id)
        .exec((err, res) => err ? reject(err) : resolve(res))
    })
  },
  forgetTransaction: (multi, channel) => {
    if (!storage.redisClient) return
    if (!(channel instanceof Discord.GuildChannel)) throw new TypeError('Channel is not instance of Discord.GuildChannel')
    multi.srem(storage.redisKeys.guildChannelsOf(channel.guild.id), channel.id)
    multi.hdel(storage.redisKeys.channelNames(channel.guild.id), channel.id)
  },
  isChannelOfGuild: async (channelId, guildId) => {
    if (!storage.redisClient) return
    if (!channelId || !guildId) throw new TypeError('Channel or guild ID is not defined')
    return promisify(storage.redisClient.sismember).bind(storage.redisClient)(storage.redisKeys.guildChannelsOf(guildId), channelId)
  },
  getName: async channelId => {
    if (!storage.redisClient) return
    if (!channelId) throw new TypeError('Channel ID is not defined')
    return promisify(storage.redisClient.hget).bind(storage.redisClient)(storage.redisKeys.channelNames(), channelId)
  },
  getChannelsOfGuild: async guildId => {
    if (!storage.redisClient) return
    if (!guildId) throw new TypeError('Guild ID is not defined')
    return promisify(storage.redisClient.smembers).bind(storage.redisClient)(storage.redisKeys.guildChannelsOf(guildId))
  }
}

exports.roles = {
  STORED_KEYS: ['id', 'guildId', 'name', 'hexColor', 'position'],
  recognize: async role => {
    if (!storage.redisClient) return
    if (!(role instanceof Discord.Role)) throw new TypeError('Role is not instance of Discord.Role')
    const toStore = {}
    exports.roles.STORED_KEYS.forEach(key => {
      toStore[key] = key === 'guildId' ? role.guild.id : role[key] === undefined ? '' : role[key] // Check of undefined explicitly since a falsy check will erroneously trigger for a value of 0 for role.position
    })
    return new Promise((resolve, reject) => {
      storage.redisClient.multi()
        .sadd(storage.redisKeys.guildRolesOf(role.guild.id), role.id)
        .sadd(storage.redisKeys.guildRolesManagersOf(role.guild.id), role.id)
        .hmset(storage.redisKeys.role(role.id), toStore)
        .exec((err, res) => err ? reject(err) : resolve(res))
    })
  },
  recognizeTransaction: (multi, role) => {
    if (!storage.redisClient) return
    if (!(role instanceof Discord.Role)) throw new TypeError('Role is not instance of Discord.Role')
    const toStore = {}
    exports.roles.STORED_KEYS.forEach(key => {
      toStore[key] = key === 'guildId' ? role.guild.id : role[key] === undefined ? '' : role[key]
    })
    multi
      .sadd(storage.redisKeys.guildRolesOf(role.guild.id), role.id)
      .sadd(storage.redisKeys.guildRolesManagersOf(role.guild.id), role.id)
      .hmset(storage.redisKeys.role(role.id), toStore)
  },
  update: async (oldRole, newRole) => {
    if (!storage.redisClient) return
    if (!(oldRole instanceof Discord.Role) || !(newRole instanceof Discord.Role)) throw new TypeError('Role is not instance of Discord.Role')
    const exists = await promisify(storage.redisClient.exists).bind(storage.redisClient)(storage.redisKeys.role(newRole.id))
    if (!exists) return exports.roles.recognize(newRole)
    const toStore = {}
    exports.roles.STORED_KEYS.forEach(key => {
      if (newRole[key] !== oldRole[key]) toStore[key] = newRole[key] === undefined ? '' : newRole[key]
    })
    if (Object.keys(toStore).length > 0) return promisify(storage.redisClient.hmset).bind(storage.redisClient)(storage.redisKeys.role(newRole.id), toStore)
    else return 0
  },
  forget: async role => {
    if (!storage.redisClient) return
    if (!(role instanceof Discord.Role)) throw new TypeError('Role is not instance of Discord.Role')
    return new Promise((resolve, reject) => {
      storage.redisClient.multi()
        .srem(storage.redisKeys.guildRolesOf(role.guild.id), role.id)
        .srem(storage.redisKeys.guildRolesManagersOf(role.guild.id), role.id)
        .del(storage.redisKeys.role(role.id))
        .exec((err, res) => err ? reject(err) : resolve(res))
    })
  },
  addManager: async role => {
    if (!storage.redisClient) return
    if (!(role instanceof Discord.Role)) throw new TypeError('Role is not instance of Discord.Role')
    return promisify(storage.redisClient.sadd).bind(storage.redisClient)(storage.redisKeys.guildRolesManagersOf(role.guild.id), role.id)
  },
  removeManager: async role => {
    if (!storage.redisClient) return
    if (!(role instanceof Discord.Role)) throw new TypeError('Role is not instance of Discord.Role')
    return promisify(storage.redisClient.srem).bind(storage.redisClient)(storage.redisKeys.guildRolesManagersOf(role.guild.id), role.id)
  },
  forgetTransaction: (multi, role) => {
    if (!storage.redisClient) return
    if (!(role instanceof Discord.Role)) throw new TypeError('Member is not instance of Discord.Role')
    multi
      .srem(storage.redisKeys.guildRolesOf(role.guild.id), role.id)
      .srem(storage.redisKeys.guildRolesManagersOf(role.guild.id), role.id)
      .del(storage.redisKeys.role(role.id))
  },
  isRoleOfGuild: async (roleId, guildId) => {
    if (!storage.redisClient) return
    if (!roleId || !guildId) throw new TypeError('Role or guild ID is not defined')
    return promisify(storage.redisClient.sismember).bind(storage.redisClient)(storage.redisKeys.guildRolesOf(guildId), roleId)
  },
  isManagerOfGuild: async (roleId, guildId) => {
    if (!storage.redisClient) return
    if (!roleId || !guildId) throw new TypeError('Role or guild ID is not defined')
    return promisify(storage.redisClient.sismember).bind(storage.redisClient)(storage.redisKeys.guildRolesManagersOf(guildId), roleId)
  },
  get: async roleId => {
    if (!storage.redisClient) return
    if (!roleId || typeof roleId !== 'string') throw new TypeError('roleId not a valid string')
    return promisify(storage.redisClient.hgetall).bind(storage.redisClient)(storage.redisKeys.role(roleId))
  },
  getValue: async (roleId, key) => {
    if (!storage.redisClient) return
    if (!exports.roles.STORED_KEYS.includes(key)) throw new Error('Unknown key for role:', key)
    if (!roleId || !key) throw new TypeError('roleId or key is undefined')
    return promisify(storage.redisClient.hget).bind(storage.redisClient)(storage.redisKeys.role(roleId), key)
  },
  getRolesOfGuild: async guildId => {
    if (!storage.redisClient) return
    if (!guildId) throw new TypeError('Guild ID is not defined')
    return promisify(storage.redisClient.smembers).bind(storage.redisClient)(storage.redisKeys.guildRolesOf(guildId))
  }
}

exports.users = {
  STORED_KEYS: ['username', 'displayAvatarURL', 'discriminator', 'id'],
  recognize: async user => {
    if (!storage.redisClient) return
    if (!(user instanceof Discord.User)) throw new TypeError('User is not instance of Discord.User')
    const toStore = {}
    exports.users.STORED_KEYS.forEach(key => {
      toStore[key] = user[key] || '' // MUST be a flat structure
    })
    return promisify(storage.redisClient.hmset).bind(storage.redisClient)(storage.redisKeys.user(user.id), toStore)
  },
  update: async (oldUser, newUser) => {
    if (!storage.redisClient) return
    if (!(oldUser instanceof Discord.User) || !(newUser instanceof Discord.User)) throw new TypeError('User is not instance of Discord.User')
    const exists = await promisify(storage.redisClient.exists).bind(this)(storage.redisKeys.user(newUser.id))
    if (!exists) await exports.guilds.recognize(newUser)
    else {
      const toStore = {}
      exports.users.STORED_KEYS.forEach(key => {
        if (newUser[key] !== oldUser[key]) toStore[key] = newUser[key]
      })
      if (Object.keys(toStore).length > 0) return promisify(storage.redisClient.hset).bind(storage.redisClient)(storage.redisKeys.user(newUser.id), toStore)
      else return 0
    }
  },
  get: async userId => {
    if (!storage.redisClient) return
    if (!userId || typeof userId !== 'string') throw new TypeError('userId not a valid string')
    return promisify(storage.redisClient.hgetall).bind(storage.redisClient)(storage.redisKeys.user(userId))
  },
  getValue: async (userId, key) => {
    if (!storage.redisClient) return
    if (!exports.users.STORED_KEYS.includes(key)) throw new Error('Unknown key for role:', key)
    if (!userId || !key) throw new TypeError('userId or key is undefined')
    return promisify(storage.redisClient.hget).bind(storage.redisClient)(storage.redisKeys.user(userId), key)
  }
}

exports.events = {
  NAMES: {
    DRSS_PROFILE_UPDATE: 'DRSS_PROFILE_UPDATE'
  },
  emitUpdatedProfile: guildId => {
    if (!storage.redisClient) return
    if (!guildId) throw new TypeError(`Guild ID is not defined`)
    storage.redisClient.publish(exports.events.NAMES.DRSS_PROFILE_UPDATE, guildId)
  }
}

exports.flushDatabase = async () => {
  if (!storage.redisClient) return
  const keys = await promisify(storage.redisClient.keys).bind(storage.redisClient)('drss*')
  const multi = storage.redisClient.multi()
  if (keys && keys.length > 0) {
    for (const key of keys) {
      multi.del(key)
    }
    return new Promise((resolve, reject) => multi.exec((err, res) => err ? reject(err) : resolve(res)))
  }
  // return promisify(storage.redisClient.flushdb).bind(storage.redisClient)()
}
