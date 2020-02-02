import {
  SET_ACTIVE_GUILD
} from '../constants/actions/guilds'

const initialState = ''

export default function activeGuildIDReducer (state = initialState, action) {
  switch (action.type) {
    case SET_ACTIVE_GUILD:
      return action.payload
    default:
      return state
  }
}
