import { TEST_ACTION, CHANGE_PAGE, CHANGE_FEED, ADD_FEED, REMOVE_FEED, SET_GUILD_CHANNELS, SET_GUILD_AUTHORIZATION, SET_ACTIVE_GUILD } from '../constants/action-types.js'

export function testAction (payload) {
  return { type: TEST_ACTION, payload }
}

export function changePage (page) {
  return { type: CHANGE_PAGE, page }
}

export function changeFeed (rssName, data) {
  return { type: CHANGE_FEED, rssName, data }
}

export function addFeed (feed) {
  return { type: ADD_FEED, feed }
}

export function removeFeed (rssName) {
  return { type: REMOVE_FEED, rssName }
}

export function setGuildChannels (channels) {
  return { type: SET_GUILD_CHANNELS, channels }
}

export function setGuildAuthorization (authorized) {
  return { type: SET_GUILD_AUTHORIZATION, authorized }
}

export function setActiveGuild (guildId) {
  return { type: SET_ACTIVE_GUILD, guildId }
}