const connectDb = require('./src/util/connectDatabase.js')
const initialize = require('./src/initialization/index.js')
const config = require('./src/config.js')

// Models
exports.models = {
  Article: require('./src/models/Article.js'),
  Blacklist: require('./src/models/Blacklist.js'),
  FailRecord: require('./src/models/FailRecord.js'),
  Feed: require('./src/models/Feed.js'),
  Feedback: require('./src/models/Feedback.js'),
  FilteredFormat: require('./src/models/FilteredFormat.js'),
  KeyValue: require('./src/models/KeyValue.js'),
  Patron: require('./src/models/Patron.js'),
  Profile: require('./src/models/Profile.js'),
  Rating: require('./src/models/Rating.js'),
  Schedule: require('./src/models/Schedule.js'),
  ScheduleStats: require('./src/models/ScheduleStats.js'),
  Subscriber: require('./src/models/Subscriber.js'),
  Supporter: require('./src/models/Supporter.js')
}

// Structures
exports.Article = require('./src/structs/Article.js')
exports.Client = require('./src/structs/Client.js')
exports.ClientManager = require('./src/structs/ClientManager.js')
exports.FeedData = require('./src/structs/FeedData.js')
exports.GuildData = require('./src/structs/GuildData.js')
exports.Translator = require('./src/structs/Translator.js')

// Database Structures
exports.Blacklist = require('./src/structs/db/Blacklist.js')
exports.FailRecord = require('./src/structs/db/FailRecord.js')
exports.Feed = require('./src/structs/db/Feed.js')
exports.FilteredFormat = require('./src/structs/db/FilteredFormat.js')
exports.KeyValue = require('./src/structs/db/KeyValue.js')
exports.Patron = require('./src/structs/db/Patron.js')
exports.Profile = require('./src/structs/db/Profile.js')
exports.Schedule = require('./src/structs/db/Schedule.js')
exports.ScheduleStats = require('./src/structs/db/ScheduleStats.js')
exports.Subscriber = require('./src/structs/db/Subscriber.js')
exports.Supporter = require('./src/structs/db/Supporter.js')

// Utils
exports.FeedFetcher = require('./src/util/FeedFetcher.js')
exports.validateConfig = require('./src/util/config/schema').validate
exports.config = config
exports.schemas = require('./src/util/config/schema.js').schemas
exports.scripts = {
  runSchedule: require('./scripts/scheduleRun.js')
}
exports.migrations = {
  v6: require('./scripts/pre_v6.js')
}

// Errors
exports.errors = {
  FeedParserError: require('./src/structs/errors/FeedParserError.js'),
  RequestError: require('./src/structs/errors/RequestError.js')
}

/**
 * Necessary for npm modules to use Discord.RSS models that
 * depends on the database being connected
 *
 * @param {string} uri
 * @param {Object<string, any>} options
*/
exports.setupModels = async (uri, options) => {
  const connection = await connectDb(uri, options)
  await initialize.setupModels(connection)
}
