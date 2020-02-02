import {
  GET_ROLES
} from '../constants/actions/roles'

const initialState = []

function rolesReducer (state = initialState, action) {
  switch (action.type) {
    case GET_ROLES.SUCCESS:
      return action.payload
    default:
      return state
  }
}

export default rolesReducer
