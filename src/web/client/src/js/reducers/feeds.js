import {
  GET_FEEDS, DELETE_FEED
} from '../constants/actions/feeds'

const initialState = []

function feedsReducer (state = initialState, action) {
  switch (action.type) {
    case GET_FEEDS.SUCCESS:
      return action.payload
    case DELETE_FEED.SUCCESS:
      const feedID = action.payload
      return state.filter(feed => feed._id !== feedID)
    default:
      return state
  }
}

export default feedsReducer
