import {
  GET_GUILDS, EDIT_GUILD
} from '../constants/actions/guilds'

const initialState = []

function guildsReducer (state = initialState, action) {
  switch (action.type) {
    case GET_GUILDS.SUCCESS:
      return action.payload
    case EDIT_GUILD.SUCCESS:
      const clone = [...state]
      const updated = action.payload
      clone.forEach((guild, index) => {
        if (guild.id === updated.id) {
          clone[index] = updated
        }
      })
      return clone
    default:
      return state
  }
}

export default guildsReducer
