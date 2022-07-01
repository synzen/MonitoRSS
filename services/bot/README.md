# MonitoRSS (Formerly Discord.RSS)

This is the core repository of the MonitoRSS bot (formerly known as Discord.RSS) for development and programmatic use. For the web interface development and programmatic use, see https://github.com/synzen/MonitoRSS-Web.

For users who want to deploy MonitoRSS for personal use, see https://github.com/synzen/MonitoRSS-Clone.

---

Driven by the lack of comprehensive RSS bots available, I have decided to try my hand at creating one of my own. Designed with as much customization as possible for both users and bot hosters, while also (or should be) easy to understand.

All documentation can be found at https://docs.monitorss.xyz.

### Publicly Hosted Instance

Don't want to bother hosting your own instance? Use the publicly hosted one!

#### Website:

https://monitorss.xyz

#### Bot Invite:

https://discord.com/oauth2/authorize?client_id=268478587651358721&scope=bot&permissions=19456

### Quick Start

```
npm install monitorss
```

```js
const MonitoRSS = require("monitorss");

// Some configs are mandatory - refer to documentation
const config = {
  bot: {
    token: "abc123",
  },
  database: {
    // Can be mongodb or folder URI
    uri: "mongodb://localhost/rss",
  },
};

const settings = {
  setPresence: true,
  config,
};

const client = new MonitoRSS.ClientManager(settings);
client.start();
```

For best performance, use a mongodb database.uri instead of a directory.

### Contributing

[Read the contribution guidelines](https://github.com/synzen/MonitoRSS/blob/master/CONTRIBUTING.md). All the latest updates are commited to the dev branch.

### Testing

Run `npm test`

#### Locales

To add or contribute to menu translations (locales):

1. If the locale JSON doesn't exist in src/locales, create one by running `npm run locale-create`
2. Open the relevant locale file in src/locales
3. Add your translations (use the en-US.json locale as reference)
4. Verify your file(s) by running `npm run locale-verify` and make appropriate fixes.
5. Make a pull request for your changes! Please also make sure to put a screenshot of the output of this command in your PR.
