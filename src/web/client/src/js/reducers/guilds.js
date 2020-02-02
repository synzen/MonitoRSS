import {
  GET_GUILDS
} from '../constants/actions/guilds'

const initialState = []

function guildsReducer (state = initialState, action) {
  switch (action.type) {
    case GET_GUILDS.SUCCESS:
      return action.payload
    default:
      return state
  }
}

export default guildsReducer
