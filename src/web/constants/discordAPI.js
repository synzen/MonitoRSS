module.exports = {
  scopes: 'identify guilds',
  apiHost: 'https://discordapp.com/api',
  auth: {
    tokenHost: 'https://discordapp.com/api',
    tokenPath: '/oauth2/token',
    revokePath: '/oauth2/token/revoke',
    authorizePath: '/oauth2/authorize'
  }
}
