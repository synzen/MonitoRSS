# Discord.RSS
Driven by the lack of comprehensive RSS bots available, I have decided to try my hand at creating one of my own. Designed with as much customization as possible for both users and bot hosters, while also (or should be) easy to understand.

All documentation can be found at https://github.com/synzen/Discord.RSS/wiki.

Looking for a non-Discord version of this bot? See https://github.com/synzen/feedtracker

### Publicly Hosted Instance

Don't want to bother hosting your own instance? Use the publicly hosted one!

https://discordapp.com/oauth2/authorize?client_id=268478587651358721&scope=bot&permissions=19456

### Setting Up via Cloning Repository (for most people)

See https://github.com/synzen/Discord.RSS/wiki/Setup

### Setting Up Programatically


```
npm install discord.rss
```

```js
const DiscordRSS = require('discord.rss')

// Optional settings
const settings = {
  setPresence: true
}

const drss = new DiscordRSS.ClientManager(settings)
drss.login('token')
```
For best performance, use a mongodb database.uri instead of a directory.


### Web Interface

For instructions on how to get the web interface working, see https://github.com/synzen/Discord.RSS/tree/dev/src/web

![UI Screenshot](https://i.imgur.com/CD8mbRh.png)

### Deploy to Heroku

You can deploy the bot in a simple way to Heroku using the button below. [Click here for detailed instructions](https://github.com/synzen/Discord.RSS/issues/45).

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

*If you want to deploy manually you can [follow this guide](https://github.com/synzen/Discord.RSS/issues/95).*

### Hosting on Glitch

Click the button below to import the code to Glitch. Wait for the importing process to complete, make your project private and fill in the [Configuration](https://github.com/synzen/Discord.RSS/wiki/Configuration). Use a tool like [Uptime Robot](https://uptimerobot.com/) to prevent the bot from going offline.

[![Remix on Glitch](https://cdn.glitch.com/2703baf2-b643-4da7-ab91-7ee2a2d00b5b%2Fremix-button.svg)](https://glitch.com/edit/#!/import/github/synzen/Discord.RSS)

You can use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) for the MongoDB database and [Redis Labs](https://redislabs.com/) for the Redis database.

The web port for Glitch is 3000.

### Contributing

[Read the contribution guidelines](https://github.com/synzen/Discord.RSS/blob/master/CONTRIBUTING.md). All the latest updates are commited to the dev branch. 

### Testing

Run `npm test`

#### Locales

To add or contribute to menu translations (locales):

1. If the locale JSON doesn't exist in src/locales, create one by running `node scripts/locales/create.js`
2. Open the relevant locale file in src/locales
3. Add your translations (use the en-US.json locale as reference)
4. Verify your file(s) by running `node scripts/locales/verify.js` and make appropriate fixes
4. Make a pull request for your changes!
