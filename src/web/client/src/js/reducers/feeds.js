import {
  GET_FEEDS
} from '../constants/actions/feeds'

const initialState = []

function feedsReducer (state = initialState, action) {
  switch (action.type) {
    case GET_FEEDS.SUCCESS:
      return action.payload
    default:
      return state
  }
}

export default feedsReducer
