import { createStore, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import rootReducer from '../reducers/index-reducer.js'

const activeFeedID = window.localStorage.getItem('activeFeedID')
const activeGuildID = window.localStorage.getItem('activeGuildID')
const initialState = {
  activeFeedID,
  activeGuildID
}

const store = createStore(rootReducer, initialState, applyMiddleware(thunk))

store.subscribe(() => {
  const { activeGuildID, activeFeedID } = store.getState()
  const storedFeedID = window.localStorage.getItem('activeFeedID')
  const storedGuildID = window.localStorage.getItem('activeGuildID')
  if (activeFeedID && storedFeedID !== activeFeedID) {
    window.localStorage.setItem('activeFeedID', activeFeedID)
  }
  if (activeGuildID && storedGuildID !== activeGuildID) {
    window.localStorage.setItem('activeGuildID', activeGuildID)
  }
})

export default store
