import { GET_BOT_USER } from 'js/constants/actions/user'

const initialState = {}

function botUserReducer (state = initialState, action) {
  switch (action.type) {
    case GET_BOT_USER.SUCCESS:
      return action.payload
    default:
      return state
  }
}

export default botUserReducer
