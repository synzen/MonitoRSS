
#Discord.RSS
Driven by the lack of comprehensive RSS bots available, I have decided to try my hand at creating one of my own. Designed with as much customization as possible for both users and bot hosters, while also (or should be) easy to understand.

As an experiment, I am hosting the bot to see how it performs and doing any potential fixes along the way. For more information, [see here](https://www.reddit.com/r/discordapp/comments/5n9l6w/discordrss_an_rss_bot/) on adding the bot to your server.

The bot should perform fine on a private server (self-hosted) since you have the ability to restart the bot should it crash. Once I have done enough testing as a public bot to deem it completely stable, I will post a [release](https://github.com/synzen/Discord.RSS/releases). In any case, whatever changes I make while testing the public bot will also apply to self-hosted bots since they are all-around improvements.

Current Progress (30 Jan 17) : RSS Feed Grabbing is now stable, currently continuing to test Discord commands stability

For steps on how to use the bot, see https://github.com/synzen/Discord.RSS/wiki.

###Built With		

##Basic Functions
 * [Node.js] (https://nodejs.org/en/)		
 * [Discord.js] (https://www.npmjs.com/package/discord.js)		
 * [Feedparser] (https://www.npmjs.com/package/feedparser)		
 * [Request] (https://www.npmjs.com/package/request)
 * Datebase Manager (choose one)		
  * [sqlite3] (https://www.npmjs.com/package/sqlite3) (default)		
  * [mysql] (https://www.npmjs.com/package/mysql)

#Customization Functions
 * [striptags] (https://www.npmjs.com/package/striptags) - To remove HTML from feeds		
 * [entities] (https://www.npmjs.com/package/entities) - Replace HTML content
 * [moment-timezone] (https://www.npmjs.com/package/moment-timezone) - Customizable timezones per guild		
