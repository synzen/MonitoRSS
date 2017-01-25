#Discord.RSS

Driven by the lack of comprehensive RSS bots available, I have decided to try my hand at creating one of my own. Designed with as much customization as possible for both users and bot hosters, while also (or should be) easy to understand.

As an experiment, I am hosting the bot to see how it performs and doing any potential fixes along the way. For more information, [see here](https://www.reddit.com/r/discordapp/comments/5n9l6w/discordrss_an_rss_bot/) on adding the bot to your server.

####Table of Contents
- [Starting the Bot](#starting-the-bot)
	- [Built With](#built-with)
- [Configuration](#configuration)
	- [Database Selection](#database-selection)
- [RSS Storage](#rss-storage)
	- [Feed Customization](#feed-customization)
		- [Tags](#tags)
	- [RSS Management](#rss-management)
- [Discord Commands](#discord-commands)
- [Noteworthy Details](#noteworthy-details)
- [Author's Note](#authors-note)

##Starting the Bot

1. Install Node https://nodejs.org/en/.
2. Clone files into a directory.
3. Use `npm install` in the directory from terminal/command prompt/etc.
4. Create and get a bot token from https://discordapp.com/developers/applications/me.
5. Invite your bot to your server with a link generated from https://discordapi.com/permissions.html, putting your bot's client ID there.
6. Put your bot token and change whatever else you need to in [config.json](#configuration)
7. Start the bot by `node server.js` in terminal/command prompt/etc.
8. Add feeds either [via Discord](#discord-commands), or [manually create](#rss-storage) and [customize](#feed-customization) in the sources folder.
9. Optionally use the the [forever module](https://www.npmjs.com/package/forever) to automatically restart the bot if it crashes.

###Built With
* [Node.js] (https://nodejs.org/en/)
* [Discord.js] (https://www.npmjs.com/package/discord.js)
* [Feedparser] (https://www.npmjs.com/package/feedparser)
* [Request] (https://www.npmjs.com/package/request)
* [striptags] (https://www.npmjs.com/package/striptags) - To remove HTML from feeds
* [entities] (https://www.npmjs.com/package/entities) - To remove HTML entities from feeds
* [moment-timezone] (https://www.npmjs.com/package/moment-timezone) - For customizable timezones per guild
* Datebase Manager (choose one)
 * [sqlite3] (https://www.npmjs.com/package/sqlite3) (recommended)
 * [mysql] (https://www.npmjs.com/package/mysql)

##Configuration
(config.json)

1. `token` : Bot token to login through server.js

2. `sqlType`: See [Database Selection](#database-selection)

3. `timezone`: (Optional) This is for the {date} tag customization. By default the date will be in UTC. To add your own timezone, use a timezone from [this list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) under the TZ column.

4. `refreshTimeMinutes`: The bot will check for new feeds regularly at every interval specified in minutes here.

5. `databaseName`: Name of database that will be created.

6. `sendOldMessages`: Send unseen messages that were not caught during bot downtime after it has restarted - this may result in message spam.

7. `defaultMaxAge`: The max aged feed in days that the bot will grab if it unexpected stops.

8. `defaultMessage`: If no custom message is defined for a specific feed, this will be the message the feed will fallback to.

9. `maxFeeds`: The maximum amount of feeds each server is allowed to have.

###Database Selection
I recommend leaving this on `sqlite3`. It can be set to `sqlite3` or `mysql`, however sqlite3 should be easier to work with since it doesn't require any credentials, and the database is created in the same directory as server.js. If you are working with a large number of servers, `mysql` may be the more ideal choice.

Should you wish to try and use MySQL, it is quite simple. If you already have it installed on your system, `npm install mysql` in the server.js directory, set up your credentials in mysqlCred.json, change the `sqltype` to `mysql` in config.json, and you're done!

If you don't already have MySQL installed on your system, [install it](https://dev.mysql.com/downloads/mysql/) and set up the root account password. Then follow the same steps as above. The bot will handle everything else.

SQLite on the otherhand requires no setup. It will create the database in the same directory as server.js on first startup.

##RSS Storage
Everything is organized by guild ID and handled through the folder  `./sources`. Each JSON file is named with their guild ID, and contains that guild's RSS feeds and customizations. The basic information a guild profile must have is `id`, and `sources` where `sources` is the list of feeds along with their customizations. 

The bottom is an example of what would be in a guild source file, for example `./sources/guild_id_here.json`. The basic information for each source in a guild profile must be `name`, `channel,`, and `link`. A more comprehensive example is provided in `./sources/guild_id_here.json` (this file will be ignored by the bot on intialization). 

```javascript
"name": "My First Guild!",
"id": "1234567890",
"sources": [{
    //feed #1 settings
    "name": "there",
    "link": "http://somewebsite.com/rss/",
    "channel": "website-feeds"
    }, {
    //feed #2 settings
    }, {
    //feed #3 settings
    }]
}
```

###Feed Customization
Besides the required `name`, `link`, and `channel` fields, more can be added for customization of course!

1. `name`: Feed Name. If you can, try not to add spaces.

2. `link`: RSS Feed link.

3. `channel`: Can be the channel's ID, or a name. IDs are highly recommended.

4. `message`: Define a custom message for a feed. Use `\n` for a new line.

5. `maxAge`: (Optional) If the bot stops unexpectedly, it will grab feeds younger than the maxAge in days and send on bot restart. If `sendOldMessage` is set to `0`, this is ignored.

6. `filters`: The bot will then only send feeds to Discord if the feed has any of the words defined in these filters.
   * There are four filters available: `title`, `description`, `summary` and `author` - they are added as properties of `filters`.
   * For each filter, they can be a string or an array (`["filter one!", "two"]`) to specify more than one word/phrase. For a feed to pass the filters - if any word/phrase defined in any of the filter categories are found (case-insensitive) in the message, it will pass the filter and be sent to Discord. 

7. `embedMessage`: Define a custom embed message to go along with the text message.
   * Can be enabled or disabled with the property `enabled` (boolean).
   * This will override the normal embed that Discord sends whenever a link is posted.
   * Properties are defined through embedMessage.properties (as exemplified through the example). Properties include `color` ([*integer* format](https://www.shodor.org/stella2java/rgbint.html)), `authorTitle`, `authorAvatarURL`, `thumbnailURL`, `message`, `footerText`, and `attachURL` (boolean). Note that not all properties are available in every feed as some may return as undefined.

```javascript
	"sources": {
		"name": "there",
		"link": "http://somewebsite.com/rss/",
		"channel": "website-feeds",
		"filters": {
			"title": ["important", "key phrase"],
			"description": "stuff"
		},
		"embedMessage": {
			"enabled": 1,
			"properties": {
				"color": 8816239,
				"message": "My embed message is here!"
			}
		},
		"maxAge": 3
	}
```

####Tags
Putting tags such as {title}, {description}, {summary}, {author}, {link}, {image}, {date} will add the feed's respective information into the text. This can either be in the main message, or in the embed. Regular [Markdown formatting] (https://support.discordapp.com/hc/en-us/articles/210298617-Markdown-Text-101-Chat-Formatting-Bold-Italic-Underline-) is possible wherever Discord allows.

`"message": "{date}\nA new feed has arrived!\n\n**{title}**\n{description}"`

###RSS Management
I don't advise tampering with the `name` of feeds. Everytime a new feed is initialized, a table is created in the database. Manually changing the name of a feed will create a new table for that feed, leaving the old one unmanaged and undeleted unless you manually delete it (or change the name back and remove it through Discord). The names are there more for database management than anything.

In general if you don't want trash lying around in your database don't remove manually remove feeds from `sources`. Instead, remove them from Discord with the command `rssremove` as explained in the section below. Deleting the channel or removing the bot from the server will also purge any traces of the guild from the configs and the database.

##Discord Commands

Uncomfortable with JSON? No problem! I have scrounged up some commands for you to use. Each command must start with the prefix defined in config.json (literally the first line, set to default as `~`). All of the above features are included.

Each command will open a menu for you to select the RSS in that channel to modify, except `rssadd` which must have a link after it. Whatever you're trying to customize, if it is a non-URL/number field, you can use [tags](#tags) to add the feed's information. The user must have Manage Channels permission to use the commands.

[`rsshelp`]: List the commands to use for Discord.RSS

[`rssadd`]: Add feeds for that specific channel. `(prefix)rssadd rss_link_here`. A new entry will be made in config.json with its name in the format of channelID_feedLink, and will use the default message formatting unless customized otherwise.

[`rssremove`]: To remove feeds. After menu selection, the feed will automatically be removed from config.json.

[`rssmessage`]: Set the custom text message of the feed that will be sent.

[`rssembed`]: Enable and set embed properties to be sent in addition to its regular message.

[`rssfilteradd`]: Add filters for specific categories for a feed.

[`rssfilterremove`]: Remove filters for specific categories for a feed.

[`rsstimezone`]: Add a timezone to be applied for {date} tags in all feeds for the guild.

[`rsstest`]: Print out the properties for that specific RSS feed and its filter status on whether it passed (if filters exist), along with a randomly chosen feed of any age - in the defined message/embed format in config.json. This was to ease the pains of having to wait for an RSS feed to come just to see how it would look once you designed it in the config.

This is especially useful when you want to add the feed's title and/or description, but you don't know if they'll turn out undefined. However, if the message is too long (that is, over the 2000 character limit), it will not send.


##Noteworthy Details

   * Custom emojis use a different format - it must be in the format of `<:emoji_name:12345>` with 12345 being the emoji's URL ID. The ID can be retrieved by getting the emoji's URL and copying the number in the URL.
   
   * If you want to link something, but you don't want Discord to automatically embed the link (AKA preview), add `<` and `>` around the link.

   * ~~This bot was made with private server owners in mind. Its stability beyond that is unpredictable.~~ Public usage of the bot is now being tested. See the info at the top.

   * Upon starting the bot with a never before seen RSS feed (AKA, when its first added/first seen in the config), it will all store available feeds at that time and put it into the database instead of sending it to Discord. This will prevent your server from being spammed by the bot with messages.
      * Upon starting the bot with an already recorded RSS feed, it will retrieve feeds and send it to the Discord server with respect to its `maxAge`, UNLESS `sendOldMessages` is set to false in the config.
      * Once the initialization process after the bot has started has finished, the bot will then retrieve and send any new feeds to Discord afterwards.

   * If you already have a bot active, you can simply use that bot's token and that bot will inherit the functionality of this RSS bot.

   * You can check the validity of your configuration through [JSONLint](http://jsonlint.com/) if you choose to do the manual configuration by directly editing the feed sources.
   
   * The bot should be stable on a private server. Once I have done enough testing as a public bot to deem it stable, I will post a [release](https://github.com/synzen/Discord.RSS/releases).

##Author's Note

This is in fact my first Javascript project. If you have any potential suggestions/improvements, I'm very open to hearing them out.
