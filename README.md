# Discord.RSS

This is the core repository of the Discord.RSS bot for development and programmatic use. For the web interface development and programmatic use, see https://github.com/synzen/Discord.RSS-Web.

For users who want to deploy Discord.RSS for personal use, see https://github.com/synzen/Discord.RSS-Clone.

***

Driven by the lack of comprehensive RSS bots available, I have decided to try my hand at creating one of my own. Designed with as much customization as possible for both users and bot hosters, while also (or should be) easy to understand.

All documentation can be found at https://docs.discordrss.xyz.

### Publicly Hosted Instance

Don't want to bother hosting your own instance? Use the publicly hosted one!

#### Website:

https://discordrss.xyz

#### Bot Invite:

https://discord.com/oauth2/authorize?client_id=268478587651358721&scope=bot&permissions=19456

### Quick Start


```
npm install discord.rss
```

```js
const DiscordRSS = require('discord.rss')

// Some configs are mandatory - refer to documentation
const config = {
  bot: {
    token: 'abc123'
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
```

For best performance, use a mongodb database.uri instead of a directory.

### Contributing

[Read the contribution guidelines](https://github.com/synzen/Discord.RSS/blob/master/CONTRIBUTING.md). All the latest updates are commited to the dev branch. 

### Testing

Run `npm test`

#### Locales

To add or contribute to menu translations (locales):

1. If the locale JSON doesn't exist in src/locales, create one by running `npm run locale-create`
2. Open the relevant locale file in src/locales
3. Add your translations (use the en-US.json locale as reference)
4. Verify your file(s) by running `npm run locale-verify` and make appropriate fixes
4. Make a pull request for your changes!
