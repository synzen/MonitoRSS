import {
  SET_ACTIVE_FEED
} from '../constants/actions/feeds'

const initialState = ''

export default function activeFeedIDReducer (state = initialState, action) {
  switch (action.type) {
    case SET_ACTIVE_FEED:
      return action.payload
    default:
      return state
  }
}
