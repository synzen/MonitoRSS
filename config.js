const config = require('./config.json')

// Environment variable in Docker container and Heroku if available
config.bot.token = !process.env.DRSS_BOT_TOKEN || process.env.DRSS_BOT_TOKEN === 'drss_docker_token' ? (config.bot.token || 's') : process.env.DRSS_BOT_TOKEN

// process.env.MONGODB_URI is intended for use by Heroku
config.database.uri = process.env.DRSS_DATABASE_URI || process.env.MONGODB_URI || config.database.uri

// Heroku deployment configuration
config.bot.prefix = process.env.DRSS_BOT_PREFIX || config.bot.prefix
config.bot.controllerIds = process.env.DRSS_BOT_CONTROLLER_IDS.replace(" ", "").split(",") || config.bot.controllerIds
config.feeds.refreshTimeMinutes = Number(process.env.DRSS_FEEDS_REFRESH_TIME_MINUTES) || config.feeds.refreshTimeMinutes
config.feeds.defaultMessage = process.env.DRSS_FEEDS_DEFAULT_MESSAGE || config.feeds.defaultMessage

module.exports = config
