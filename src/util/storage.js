// Used to store data for various operations across multiple files

/**
 * @type {import('discord.js').Client}
 */
exports.bot = undefined

/**
 * @type {import('redis').RedisClient}
 */
exports.redisClient = undefined

/**
 * Guild command prefixes
 * @type {Object<string, string>}
 */
exports.prefixes = {}

/**
 * Different levels dictate what commands may be used while the bot is booting up. 0 = While all shards not initialized, 1 = While shard is initialized, 2 = While all shards initialized
 * @type {0|1|2}
 */
exports.initialized = 0

/**
 * Any deleted rssNames to check during article sending to see if it was deleted during a cycle
 * @type {string[]}
 */
exports.deletedFeeds = []

/**
 * @type {import('../structs/ScheduleManager.js')}
 */
exports.scheduleManager = undefined
