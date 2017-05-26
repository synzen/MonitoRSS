
# Discord.RSS
Driven by the lack of comprehensive RSS bots available, I have decided to try my hand at creating one of my own. Designed with as much customization as possible for both users and bot hosters, while also (or should be) easy to understand.

The bot performs fine on a private server (self-hosted) since you can track and monitor its progress. Once I have done enough testing as a public bot to deem it stable, I will post a [release](https://github.com/synzen/Discord.RSS/releases). In any case, whatever changes I make while testing the public bot will also apply to self-hosted bots since they are all-around improvements.

For steps on how to host the bot on your own, and on using the bot itself, see https://github.com/synzen/Discord.RSS/wiki.

## Built With		
* [Node.js](https://nodejs.org/en/)		
* [Discord.js](https://www.npmjs.com/package/discord.js)

#### Core Functions
 * [Feedparser](https://www.npmjs.com/package/feedparser)		
 * [needle](https://www.npmjs.com/package/needle)
 * [cloudscraper](https://www.npmjs.com/package/cloudscraper)
 * Datebase Manager (one of two options)		
     * [sqlite3](https://www.npmjs.com/package/sqlite3) (default)		
     * [mysql](https://www.npmjs.com/package/mysql)

#### Customization Functions
 * [striptags](https://www.npmjs.com/package/striptags) - Remove HTML content
 * [entities](https://www.npmjs.com/package/entities) - Replace HTML content
 * [moment-timezone](https://www.npmjs.com/package/moment-timezone) - Customizable timezones
