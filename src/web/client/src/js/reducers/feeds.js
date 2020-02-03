import {
  GET_FEEDS, DELETE_FEED, EDIT_FEED
} from '../constants/actions/feeds'

const initialState = []

function feedsReducer (state = initialState, action) {
  switch (action.type) {
    case GET_FEEDS.SUCCESS:
      return action.payload
    case DELETE_FEED.SUCCESS:
      const feedID = action.payload
      return state.filter(feed => feed._id !== feedID)
    case EDIT_FEED.SUCCESS:
      const clone = [...state]
      const updatedFeed = action.payload
      for (let i = 0; i < clone.length; ++i) {
        const feed = clone[i]
        if (feed._id !== updatedFeed._id) {
          continue
        }
        clone[i] = updatedFeed
        return clone
      }
    default:
      return state
  }
}

export default feedsReducer
