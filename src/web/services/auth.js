const config = require('../../config.js')
const userServices = require('../services/user.js')
const discordAPIConstants = require('../constants/discordAPI.js')

/**
 * @typedef {Object} Session
 * @property {Object} token
 * @property {Object} identity
 */

/**
 * @param {Session} session
 */
function isAuthenticated (session) {
  return !!(session.identity && session.token)
}

/**
  * @param {import('simple-oauth2').OAuthClient} oauthClient
  * @returns {string}
  */
function getAuthorizationURL (oauthClient) {
  return oauthClient.authorizationCode.authorizeURL({
    redirect_uri: config.web.redirectUri,
    scope: discordAPIConstants.scopes
  })
}

/**
 * Attach the user's oauth2 token to req
 * @param {import('simple-oauth2').OAuthClient} oauthClient
 */
async function createAuthToken (code, oauthClient) {
  const result = await oauthClient.authorizationCode.getToken({
    code,
    redirect_uri: config.web.redirectUri,
    scope: discordAPIConstants.scopes
  })
  const accessTokenObject = oauthClient.accessToken.create(result) // class with properties access_token, token_type = 'Bearer', expires_in, refresh_token, scope, expires_at
  const session = {
    token: accessTokenObject.token,
    identity: await userServices.getInfo(null, accessTokenObject.token.access_token)
  }
  return session
}

/**
 * Attach the user's oauth2 token to req
 * @param {import('simple-oauth2').OAuthClient} oauthClient
 * @param {Session} session
 */
async function getAuthToken (oauthClient, session) {
  const tokenObject = oauthClient.accessToken.create(session.auth)
  if (!tokenObject.expired()) {
    return tokenObject.token
  }
  const newTokenObject = await tokenObject.refresh()
  return newTokenObject.token
}

/**
 * Attach the user's oauth2 token to req
 * @param {import('simple-oauth2').OAuthClient} oauthClient
 * @param {Session} session
 */
async function logout (oauthClient, session) {
  await oauthClient.accessToken.create(session.auth).revokeAll()
  return new Promise((resolve, reject) => {
    session.destroy(err => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

module.exports = {
  isAuthenticated,
  getAuthorizationURL,
  createAuthToken,
  getAuthToken,
  logout
}
