#Discord.RSS

Driven by the lack of comprehensive RSS bots available, I have decided to try my hand at creating one of my own. Designed with as much customization as possible for both users and bot hosters, while also (or should be) easy to understand.

As an experiment, I am hosting the bot to see how it performs and doing any potential fixes along the way. For more information, [see here](https://www.reddit.com/r/discordapp/comments/5n9l6w/discordrss_an_rss_bot/) on adding the bot to your server.

The bot should perform fine on a private server (self-hosted) since you have the ability to restart the bot should it crash. Once I have done enough testing as a public bot to deem it completely stable, I will post a [release](https://github.com/synzen/Discord.RSS/releases). In any case, whatever changes I make while testing the public bot will also apply to self-hosted bots since they are all-around improvements.

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

Currently migrating to Wiki page, see https://github.com/synzen/Discord.RSS/wiki/Starting-the-Bot

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

Currently migrating to Wiki page, see https://github.com/synzen/Discord.RSS/wiki/Configuration

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

3. `channel`: Can be the channel's ID, or a name.

4. `message`: (Optional) Define a custom message for a feed. Use `\n` for a new line.

5. `maxAge`: (Optional) If the bot stops unexpectedly, it will grab feeds younger than the maxAge in days and send on bot restart. If `sendOldMessage` is set to `0`, this is ignored.

6. `subscribedRoles`: (Optional) An array of roles that will be mentioned on every new article sent from a feed. (More details to be added)

7. `filters`: (Optional) The bot will then only send feeds to Discord if the feed has any of the words defined in these filters.
   * There are four filters available: `title`, `description`, `summary` and `author` - they are added as properties of `filters`.
   * For each filter, they must be an array (`["filter one!", "two"]`). For a feed to pass the filters - if any word/phrase defined in any of the filter categories are found (case-insensitive) in the message, it will pass the filter and be sent to Discord.
   * In addition to the above, another object can be made - `subscribedRoles` (not the same as #6). Here you can define role-specific filters that will determine when they will be mentioned instead of global mentioning as in #6. If manually added, global subscriptions will override this. Otherwise, Discord commands will automatically remove one or the other when setting global or filter-specific role subscriptions. (More details to be added)

8. `embedMessage`: (Optional) Define a custom embed message to go along with the text message.
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

[`rssfilters`]: Add or remove filters for specific categories for a feed.

[`rsstimezone`]: Add a timezone to be applied for {date} tags in all feeds for the guild.

[`rssroles`]: Set role subscriptions - either global subscriptions that will mention a role every time a new article from a feed is posted, or filtered subscriptions where the role will only be mentioned with its role-specific filters.

[`rsstest`]: Print out the properties for that specific RSS feed and its filter status on whether it passed (if filters exist), along with a randomly chosen feed of any age - in the defined message/embed format in config.json. This was to ease the pains of having to wait for an RSS feed to come just to see how it would look once you designed it in the config. (The role filters are done *after* the feed filters defined from `rssfilters` if they exist.

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

##Author's Note

This is in fact my first Javascript project. If you have any potential suggestions/improvements, I'm very open to hearing them out.
