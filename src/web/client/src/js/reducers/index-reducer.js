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

export default rootReducer
