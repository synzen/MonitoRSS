/*******************************
          GitHub Login
*******************************/
/*
  Logs into GitHub using OAuth
*/

var
  fs = require('fs')

var path = require('path')

var githubAPI = require('github')

// stores oauth info for GitHub API

var oAuthConfig = path.join(__dirname, 'oauth.js')

var oAuth = fs.existsSync(oAuthConfig)
  ? require(oAuthConfig)
  : false

var github

if (!oAuth) {
  console.error('Must add oauth token for GitHub in tasks/config/admin/oauth.js')
}

github = new githubAPI({
  version: '3.0.0',
  debug: true,
  protocol: 'https',
  timeout: 5000
})

github.authenticate({
  type: 'oauth',
  token: oAuth.token
})

module.exports = github
