import { combineReducers } from 'redux'
import userReducer from './user'
import guildsReducer from './guilds'
import loadingReducer from './loading'
import errorsReducer from './errors'
import channelsReducer from './channels'
import rolesReducer from './roles'
import feedsReducer from './feeds'
import activeGuildIDReducer from './activeGuildID'
import activeFeedIDReducer from './activeFeedID'
import articlesReducer from './articles'
import pageReducer from './page'
import modalReducer from './modal'
import botConfigReducer from './botConfig'
import failRecordsReducer from './failRecords'
import subscribersReducer from './subscribers'
import schedulesReducer from './schedules'
import authenticatedReducer from './authenticated'
import botUserReducer from './botUser'

const rootReducer = combineReducers({
  authenticated: authenticatedReducer,
  page: pageReducer,
  botUser: botUserReducer,
  user: userReducer,
  activeGuildID: activeGuildIDReducer,
  activeFeedID: activeFeedIDReducer,
  guilds: guildsReducer,
  channels: channelsReducer,
  articles: articlesReducer,
  roles: rolesReducer,
  feeds: feedsReducer,
  subscribers: subscribersReducer,
  loading: loadingReducer,
  errors: errorsReducer,
  modal: modalReducer,
  botConfig: botConfigReducer,
  failRecords: failRecordsReducer,
  schedules: schedulesReducer
})

// const initialState = {
//   owner: false,
//   user: undefined,
//   defaultConfig: {},
//   guildId: '',
//   feedId: '',
//   guild: null,
//   feed: null,
//   articleList: [],
//   feeds: {},
//   roles: {},
//   subscribers: {},
//   filters: {},
//   guilds: {},
//   embeds: {},
//   messages: {},
//   channels: {},
//   linkStatuses: {},
//   guildLimits: {},
//   articlesFetching: false,
//   articlesError: '',
//   modalOpen: false,
//   csrfToken: '',
//   feedRefreshRates: {},
//   cpResponse: null,
//   modal: {
//     props: null,
//     children: null
//   }
// }

// // Always use immutability-helper for updating nested objects like guildRss

// function initState (state, action) {
//   return { ...state, ...action.data }
// }

// function clearGuild (state, action) {
//   const guildIdToUse = action.guildId || state.guildId
//   return update(state, {
//     feeds: { [guildIdToUse]: { $set: undefined } },
//     filters: { [guildIdToUse]: { $set: undefined } },
//     subscriptions: { [guildIdToUse]: { $set: undefined } }
//   })
// }

// function updateGuildAfterWebSocket (state, action) {
//   const guildId = state.guildId

//   const newState = update(state, {
//     guilds: { [guildId]: { $set: {} } },
//     messages: { [guildId]: { $set: {} } },
//     embeds: { [guildId]: { $set: {} } },
//     filters: { [guildId]: { $set: {} } },
//     subscribers: { [guildId]: { $set: {} } },
//     feeds: { [guildId]: { $set: {} } }
//   })

//   const guildRss = action.guildRss
//   for (const keyName in guildRss) {
//     const value = guildRss[keyName]
//     if (typeof value !== 'object' && value !== undefined) newState.guilds[guildId][keyName] = value
//     if (keyName !== 'sources') continue
//     const rssList = value
//     for (const rssName in rssList) {
//       const source = rssList[rssName]
//       source.rssName = rssName
//       const copy = JSON.parse(JSON.stringify(source))
//       newState.feeds[guildId][rssName] = copy
//       newState.embeds[guildId][rssName] = source.embeds
//       newState.messages[guildId][rssName] = source.message
//       // Feed Filters
//       if (source.filters) newState.filters[guildId][rssName] = source.filters

//       // Feed Subscriptions
//       newState.subscribers[guildId][rssName] = {}
//       if (source.subscribers && source.subscribers.length > 0) {
//         for (const subscriber of source.subscribers) {
//           newState.subscribers[guildId][rssName][subscriber.id] = subscriber
//         }
//       }
//       if (state.feedId === rssName) newState.feed = source
//     }
//   }
//   return state.guildId === guildRss.id ? update(newState, { guild: { $set: newState.guilds[state.guildId] } }) : newState
// }

// function changePage (state, action) {
//   return update(state, { page: { $set: action.page } })
// }

// function changeFilters (state, action) {
//   const { rssName, data } = action
//   return update(state, { feeds: { [action.guildId || state.guildId]: { [rssName]: { filters: { $set: data } } } } })
// }

// function setActiveGuild (state, action) {
//   if (state.guildId === action.guildId) return state
//   return update(state, { guildId: { $set: action.guildId }, feedId: { $set: '' }, articleList: { $set: [] }, articlesError: { $set: '' }, guild: { $set: state.guilds[action.guildId] } }) // MUST be an empty string. undefined will cause some components to be unintentionally uncontrolled
// }

// function setActiveFeed (state, action) {
//   if (state.feedId === action.rssName) return state
//   return update(state, { feedId: { $set: action.rssName }, feed: { $set: JSON.parse(JSON.stringify(state.feeds[state.guildId][action.rssName])) } })
// }

// function articlesFetched (state, action) {
//   return update(state, { articlesFetching: { $set: false }, articleList: { $set: action.articleList }, articlesError: { $set: '' } })
// }

// function articlesFetching (state, action) {
//   return update(state, { articlesFetching: { $set: true }, articleList: { $set: [] }, articlesError: { $set: '' } })
// }

// function articlesError (state, action) {
//   return update(state, { articlesFetching: { $set: false }, articlesError: { $set: action.err } })
// }

// function updateLinkStatus (state, action) {
//   return update(state, { linkStatuses: { [action.data.link]: { $set: action.data.status } } })
// }

// function updateGuildLimits (state, action) {
//   let newState = state
//   for (const guildId in action.limits) {
//     newState = update(newState, { guildLimits: { [guildId]: { $set: action.limits[guildId] } } })
//   }
//   return newState
// }

// function showModal (state, action) {
//   return update(state, {
//     modalOpen: { $set: true },
//     modal: { children: { $set: action.children }, props: { $set: action.props } }
//   })
// }

// function hideModal (state, action) {
//   return update(state, { modalOpen: { $set: false } })
// }

// function updateSourceSchedule (state, action) {
//   const { guildId, rssName, refreshTimeMinutes } = action.data
//   return update(state, { refreshRates: { [guildId]: { [rssName]: { $set: refreshTimeMinutes } } } })
// }

// function rootReducer (state = initialState, action) {
//   if (action.type === TEST_ACTION) {
//     return update(state, { testVal: { $set: action.payload } })
//   } else if (action.type === INIT_STATE) {
//     return initState(state, action)
//   } else if (action.type === CLEAR_GUILD) {
//     return clearGuild(state, action)
//   } else if (action.type === UPDATE_GUILD_AFTER_WEBSOCKET) {
//     return updateGuildAfterWebSocket(state, action)
//   } else if (action.type === CHANGE_PAGE) {
//     return changePage(state, action)
//   } else if (action.type === CHANGE_FILTERS) {
//     return changeFilters(state, action)
//   } else if (action.type === SET_ACTIVE_GUILD) {
//     return setActiveGuild(state, action)
//   } else if (action.type === SET_ACTIVE_FEED) {
//     return setActiveFeed(state, action)
//   } else if (action.type === ARTICLES_FETCHED) {
//     return articlesFetched(state, action)
//   } else if (action.type === ARTICLES_FETCHING) {
//     return articlesFetching(state, action)
//   } else if (action.type === ARTICLES_ERROR) {
//     return articlesError(state, action)
//   } else if (action.type === UPDATE_LINK_STATUS) {
//     return updateLinkStatus(state, action)
//   } else if (action.type === UPDATE_GUILD_LIMITS) {
//     return updateGuildLimits(state, action)
//   } else if (action.type === SHOW_MODAL) {
//     return showModal(state, action)
//   } else if (action.type === HIDE_MODAL) {
//     return hideModal(state, action)
//   } else if (action.type === UPDATE_SOURCE_SCHEDULE) {
//     return updateSourceSchedule(state, action)
//   }

//   return state
// }

export default rootReducer
