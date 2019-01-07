import { UPDATE_GUILD, TEST_ACTION, CHANGE_PAGE, CHANGE_FEED, ADD_FEED, REMOVE_FEED, SET_GUILD_CHANNELS, SET_GUILD_AUTHORIZATION, SET_ACTIVE_GUILD } from '../constants/action-types'
import update from 'immutability-helper'

const initialState = {
  testVal: 'Initial State Value',
  activeGuild: '',
  activeFeed: '',
  feeds: {},
  guilds: {},
  channels: {}
}

// Always use immutability-helper for updating nested objects like guildRss

function rootReducer (state = initialState, action) {
  const guildId = state.activeGuild

  if (action.type === TEST_ACTION) {
    return update(state, { testVal: { $set: action.payload } })

  } else if (action.type === UPDATE_GUILD) {
    return update(state, { guildRss: { $set: action.payload } })

  } else if (action.type === CHANGE_PAGE) {
    return update(state, { page: { $set: action.page } })
    
  } else if (action.type === CHANGE_FEED) {
    const guildFeeds = state.feeds[state.activeGuild]
    if (!guildFeeds) return state
    const guildFeedsClone = [ ...guildFeeds ]
    for (let i = 0; i < guildFeedsClone.length; ++i) {
      const feed = guildFeedsClone[i]
      if (feed.rssName !== action.rssName) continue
      const feedClone = { ...feed }
      for (const key in action.data) feedClone[key] = action.data[key]
      guildFeedsClone[i] = feedClone
      return update(state, { feeds: { [guildId]: { $set: guildFeedsClone } } })
    }

  } else if (action.type === 'INIT_STATE') {
    const data = action.data
    const objectQuery = { user: { $set: data.user } }
    for (const name in data) {
      objectQuery[name] = { $set: data[name] }
    }
    return update(state, objectQuery)

  } else if (action.type === SET_GUILD_CHANNELS) {
    return update(state, { channels: { [guildId]: { $set: action.channels } } })

  } else if (action.type === SET_GUILD_AUTHORIZATION) {
    return update(state, { guilds: { [guildId]: { authorized: { $set: action.authorized } } } })

  } else if (action.type === SET_ACTIVE_GUILD) {
    return update(state, { activeGuild: { $set: action.guildId } })

  } else if (action.type === ADD_FEED) {
    const { feed } = action
    if (!Array.isArray(state.feeds[guildId])) return update(state, { feeds: { [guildId]: { $set: [ feed ] } } })
    else return update(state, { feeds: { [guildId]: { $push: [ feed ] } } })

  } else if (action.type === REMOVE_FEED) {
    const { rssName } = action
    const feedArr = [ ...state.feeds[guildId] ]
    if (!feedArr) return state
    for (let i = feedArr.length - 1; i >= 0; --i) {
      if (feedArr[i].rssName !== rssName) continue
      feedArr.splice(i, 1)
      return update(state, { feeds: { [guildId]: { $set: feedArr } } })
    }
  }
  return state
}

export default rootReducer
