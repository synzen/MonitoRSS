import {
  GET_CHANNELS
} from '../constants/actions/channels'

const initialState = []

function channelsReducer (state = initialState, action) {
  switch (action.type) {
    case GET_CHANNELS.SUCCESS:
      return action.payload
    default:
      return state
  }
}

export default channelsReducer
