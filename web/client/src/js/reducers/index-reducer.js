import { TEST_ACTION, CHANGE_PAGE, SET_ACTIVE_GUILD, SET_ACTIVE_FEED, INIT_STATE, CHANGE_FILTERS, CLEAR_GUILD, UPDATE_GUILD_AFTER_WEBSOCKET, ARTICLES_FETCHING, ARTICLES_ERROR, ARTICLES_FETCHED, UPDATE_LINK_STATUS, UPDATE_GUILD_LIMITS, SHOW_MODAL, HIDE_MODAL, UPDATE_SOURCE_SCHEDULE } from '../constants/action-types'
import update from 'immutability-helper'

const initialState = {
  user: undefined,
  defaultConfig: {},
  guildId: '',
  feedId: '',
  guild: null,
  feed: null,
  articleList: [],
  feeds: {},
  roles: {},
  subscribers: {},
  filters: {},
  guilds: {},
  embeds: {},
  messages: {},
  channels: {},
  linkStatuses: {},
  guildLimits: {},
  articlesFetching: false,
  articlesError: '',
  modalOpen: false,
  csrfToken: '',
  refreshRates: {},
  cpResponse: null,
  modal: {
    props: null,
    children: null
  }
}

// Always use immutability-helper for updating nested objects like guildRss

function rootReducer (state = initialState, action) {
  const guildId = state.guildId

  if (action.type === TEST_ACTION) {
    return update(state, { testVal: { $set: action.payload } })
  } else if (action.type === CLEAR_GUILD) {
    const guildIdToUse = action.guildId || guildId
    return update(state, {
      feeds: { [guildIdToUse]: { $set: undefined } },
      filters: { [guildIdToUse]: { $set: undefined } },
      subscriptions: { [guildIdToUse]: { $set: undefined } }
    })
  } else if (action.type === UPDATE_GUILD_AFTER_WEBSOCKET) {
    const newState = update(state, {
      guilds: { [guildId]: { $set: {} } },
      messages: { [guildId]: { $set: {} } },
      embeds: { [guildId]: { $set: {} } },
      filters: { [guildId]: { $set: {} } },
      subscribers: { [guildId]: { $set: {} } },
      feeds: { [guildId]: { $set: {} } }
    })

    const guildRss = action.guildRss
    for (const keyName in guildRss) {
      const value = guildRss[keyName]
      if (typeof value !== 'object' && value !== undefined) newState.guilds[guildId][keyName] = value
      if (keyName !== 'sources') continue
      const rssList = value
      for (const rssName in rssList) {
        const source = rssList[rssName]
        source.rssName = rssName
        const copy = JSON.parse(JSON.stringify(source))
        newState.feeds[guildId][rssName] = copy
        newState.embeds[guildId][rssName] = source.embeds
        newState.messages[guildId][rssName] = source.message
        // Feed Filters
        if (source.filters) newState.filters[guildId][rssName] = source.filters

        // Feed Subscriptions
        newState.subscribers[guildId][rssName] = {}
        if (source.subscribers && source.subscribers.length > 0) {
          for (const subscriber of source.subscribers) {
            newState.subscribers[guildId][rssName][subscriber.id] = subscriber
          }
        }
        if (state.feedId === rssName) newState.feed = source
      }
    }
    return state.guildId === guildRss.id ? update(newState, { guild: { $set: newState.guilds[state.guildId] } }) : newState
  } else if (action.type === CHANGE_PAGE) {
    return update(state, { page: { $set: action.page } })
  } else if (action.type === CHANGE_FILTERS) {
    const { rssName, data } = action
    return update(state, { feeds: { [action.guildId || guildId]: { [rssName]: { filters: { $set: data } } } } })
  } else if (action.type === INIT_STATE) {
    return { ...state, ...action.data }
  } else if (action.type === SET_ACTIVE_GUILD) {
    if (guildId === action.guildId) return state
    return update(state, { guildId: { $set: action.guildId }, feedId: { $set: '' }, articleList: { $set: [] }, articlesError: { $set: '' }, guild: { $set: state.guilds[action.guildId] } }) // MUST be an empty string. undefined will cause some components to be unintentionally uncontrolled
  } else if (action.type === SET_ACTIVE_FEED) {
    if (state.feedId === action.rssName) return state
    return update(state, { feedId: { $set: action.rssName }, feed: { $set: JSON.parse(JSON.stringify(state.feeds[guildId][action.rssName])) } })
  } else if (action.type === ARTICLES_FETCHED) {
    return update(state, { articlesFetching: { $set: false }, articleList: { $set: action.articleList }, articlesError: { $set: '' } })
  } else if (action.type === ARTICLES_FETCHING) {
    return update(state, { articlesFetching: { $set: true }, articleList: { $set: [] }, articlesError: { $set: '' } })
  } else if (action.type === ARTICLES_ERROR) {
    return update(state, { articlesFetching: { $set: false }, articlesError: { $set: action.err } })
  } else if (action.type === UPDATE_LINK_STATUS) {
    return update(state, { linkStatuses: { [action.data.link]: { $set: action.data.status } } })
  } else if (action.type === UPDATE_GUILD_LIMITS) {
    let newState = state
    for (const guildId in action.limits) {
      newState = update(newState, { guildLimits: { [guildId]: { $set: action.limits[guildId] } } })
    }
    return newState
  } else if (action.type === SHOW_MODAL) {
    return update(state, {
      modalOpen: { $set: true },
      modal: { children: { $set: action.children }, props: { $set: action.props } }
    })
  } else if (action.type === HIDE_MODAL) {
    return update(state, { modalOpen: { $set: false } })
  } else if (action.type === UPDATE_SOURCE_SCHEDULE) {
    const { guildId, rssName, refreshTimeMinutes } = action.data
    return update(state, { refreshRates: { [guildId]: { [rssName]: { $set: refreshTimeMinutes } } } })
  }

  return state
}

export default rootReducer
