const DiscordRSS = require('./index')

// Some configs are mandatory - refer to documentation
const config = {
  bot: {
    token: 'MjYzMzAzMjc0MzYxMjU3OTg1.XtUJ8Q.5CJGJJGitfp0Bh0X0kZuNY0yZ9A'
  },
  database: {
    // Can be mongodb or folder URI
    uri: 'mongodb://localhost/rss'
  }
}

const settings = {
  setPresence: true,
  config
}

const drss = new DiscordRSS.ClientManager(settings)
drss.start()
