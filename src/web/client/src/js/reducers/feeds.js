import {
  GET_FEEDS, DELETE_FEED, EDIT_FEED, ADD_FEED
} from '../constants/actions/feeds'

const initialState = []

function feedsReducer (state = initialState, action) {
  switch (action.type) {
    case GET_FEEDS.SUCCESS:
      return action.payload
    case ADD_FEED.SUCCESS:
      return [...state, action.payload]
    case DELETE_FEED.SUCCESS:
      const feedID = action.payload
      return state.filter(feed => feed._id !== feedID)
    case EDIT_FEED.SUCCESS:
      const clone = [...state]
      const updated = action.payload
      clone.forEach((feed, index) => {
        if (feed._id === updated._id) {
          clone[index] = updated
        }
      })
      return clone
    default:
      return state
  }
}

export default feedsReducer
