# Discord.RSS
Driven by the lack of comprehensive RSS bots available, I have decided to try my hand at creating one of my own. Designed with as much customization as possible for both users and bot hosters, while also (or should be) easy to understand.

All documentation can be found at https://github.com/synzen/Discord.RSS/wiki.


### Setting Up via Cloning Repository (for most people)

See https://github.com/synzen/Discord.RSS/wiki/Setup

### Setting Up with Existing Client

The fastest way to using Discord.RSS with an existing [discord.js](https://github.com/discordjs/discord.js) client with [npm](https://www.npmjs.com/package/discord.rss):


```
npm install discord.rss
```

```js
const Discord = require('discord.js')
const DiscordRSS = require('discord.rss')

const client = new Discord.Client()
const drss = new DiscordRSS.Client({ database: { uri: './sources' } }) // File-based sources instead of Mongo

client.login('token')
drss.login(client) // Can be done before or after the client is 'ready'
```
or create a new client:
```js
const DiscordRSS = require('discord.rss')

const drss = new DiscordRSS.Client({ database: { uri: './sources' } }) // Optional config overrides
drss.login('token')
```
There are multiple ways of integrating Discord.RSS programmatically - see [here](https://github.com/synzen/Discord.RSS/wiki/Use-with-Existing-Bot) for more information. For full features, use a mongodb database.uri instead of a directory.


## Built With		
* [Node.js](https://nodejs.org/en/)		
* [discord.js](https://www.npmjs.com/package/discord.js)

#### Core Functions
 * [Feedparser](https://www.npmjs.com/package/feedparser)		
 * [Needle](https://www.npmjs.com/package/needle)
 * [cloudscraper](https://www.npmjs.com/package/cloudscraper)
 * [Mongoose](https://www.npmjs.com/package/mongoose)

#### Customization Functions
 * [html-to-text](https://www.npmjs.com/package/html-to-text) - Convert HTML content
 * [moment-timezone](https://www.npmjs.com/package/moment-timezone) - Customizable timezones
