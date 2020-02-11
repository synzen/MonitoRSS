import { CHECK_AUTH } from 'js/constants/actions/auth'

const initialState = null

function authenticatedReducer (state = initialState, action) {
  switch (action.type) {
    case CHECK_AUTH.SUCCESS:
      return action.payload
    default:
      return state
  }
}

export default authenticatedReducer
