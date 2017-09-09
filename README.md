
# Discord.RSS
Driven by the lack of comprehensive RSS bots available, I have decided to try my hand at creating one of my own. Designed with as much customization as possible for both users and bot hosters, while also (or should be) easy to understand.

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
 * [html-to-text](https://www.npmjs.com/package/html-to-text) - Convert HTML content
 * [moment-timezone](https://www.npmjs.com/package/moment-timezone) - Customizable timezones
