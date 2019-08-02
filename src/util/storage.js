/*
*   Used to store data for various operations across multiple files
*/

exports.bot = undefined
exports.redisClient = undefined
exports.prefixes = {} // Guild prefixes
exports.initialized = 0 // Different levels dictate what commands may be used while the bot is booting up. 0 = While all shards not initialized, 1 = While shard is initialized, 2 = While all shards initialized
exports.deletedFeeds = [] // Any deleted rssNames to check during article sending to see if it was deleted during a cycle
exports.scheduleManager = undefined
exports.blacklistUsers = []
exports.blacklistGuilds = []
