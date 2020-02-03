import { GET_BOT_CONFIG } from 'js/constants/actions/botConfig'

const initialState = {}

function botConfigReducer (state = initialState, action) {
  switch (action.type) {
    case GET_BOT_CONFIG.SUCCESS:
      return action.payload
    default:
      return state
  }
}

export default botConfigReducer
