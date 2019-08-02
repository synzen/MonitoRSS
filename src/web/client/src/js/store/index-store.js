import { createStore, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import rootReducer from '../reducers/index-reducer.js'
const store = createStore(rootReducer, applyMiddleware(thunk))

store.subscribe(() => {
  const { guildId, feedId } = store.getState()
  const storedFeedId = window.localStorage.getItem('feedId')
  const storedGuildId = window.localStorage.getItem('guildId')
  if (feedId && storedFeedId !== feedId) window.localStorage.setItem('feedId', feedId)
  if (guildId && storedGuildId !== guildId) window.localStorage.setItem('guildId', guildId)
})

export default store
