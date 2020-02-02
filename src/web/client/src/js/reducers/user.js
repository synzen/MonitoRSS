import {
  SET_USER
} from '../constants/actions/user'

const initialState = {}

function userReducer (state = initialState, action) {
  switch (action.type) {
    case SET_USER.SUCCESS:
      return action.payload
    default:
      return state
  }
}

export default userReducer
