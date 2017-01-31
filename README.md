
#Discord.RSS
Driven by the lack of comprehensive RSS bots available, I have decided to try my hand at creating one of my own. Designed with as much customization as possible for both users and bot hosters, while also (or should be) easy to understand.

As an experiment, I am hosting the bot to see how it performs and doing any potential fixes along the way. For more information, [see here](https://www.reddit.com/r/discordapp/comments/5n9l6w/discordrss_an_rss_bot/) on adding the bot to your server.

The bot should perform fine on a private server (self-hosted) since you have the ability to restart the bot should it crash. Once I have done enough testing as a public bot to deem it completely stable, I will post a [release](https://github.com/synzen/Discord.RSS/releases). In any case, whatever changes I make while testing the public bot will also apply to self-hosted bots since they are all-around improvements.

Current Progress (30 Jan 17) : RSS Feed Grabbing is now stable, continuing to test Discord Command stability

Currently migrating to wiki, see https://github.com/synzen/Discord.RSS/wiki

##Noteworthy Details

   * Custom emojis use a different format - it must be in the format of `<:emoji_name:12345>` with 12345 being the emoji's URL ID. The ID can be retrieved by getting the emoji's URL and copying the number in the URL.

   * Upon starting the bot with a never before seen RSS feed (AKA, when its first added/first seen in the config), it will all store available feeds at that time and put it into the database instead of sending it to Discord. This will prevent your server from being spammed by the bot with messages.
      * Upon starting the bot with an already recorded RSS feed, it will retrieve feeds and send it to the Discord server with respect to its `maxAge`, UNLESS `sendOldMessages` is set to false in the config.
      * Once the initialization process after the bot has started has finished, the bot will then retrieve and send any new feeds to Discord afterwards.

   * If you already have a bot active, you can simply use that bot's token and that bot will inherit the functionality of this RSS bot.

##Author's Note

This is in fact my first Javascript project. If you have any potential suggestions/improvements, I'm open to hearing them out.
