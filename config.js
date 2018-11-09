const config = require('./config.json')

//DRSS_DISCORD_TOKEN is intended for use by Heroku
config.bot.token = process.env.DRSS_DISCORD_TOKEN || config.bot.token

// Environment variable in Docker container if available
config.bot.token = !process.env.DRSS_BOT_TOKEN || process.env.DRSS_BOT_TOKEN === 'drss_docker_token' ? (config.bot.token || 's') : process.env.DRSS_BOT_TOKEN

// process.env.MONGODB_URI is intended for use by Heroku
config.database.uri = process.env.DRSS_DATABASE_URI || process.env.MONGODB_URI || config.database.uri

// Heroku deployment configuration
config.bot.prefix = process.env.DRSS_BOT_PREFIX || config.bot.prefix
config.feeds.refreshTimeMinutes = Number(process.env.DRSS_FEEDS_REFRESH_TIME_MINUTES) || config.feeds.refreshTimeMinutes
config.feeds.defaultMessage = process.env.DRSS_FEEDS_DEFAULT_MESSAGE || config.feeds.defaultMessage

module.exports = config
