import axios from 'axios'
import {
  GET_ROLES
} from '../constants/actions/roles'

export function fetchGuildRoles (guildID) {
  return async dispatch => {
    try {
      dispatch(setRolesBegin())
      const { data } = await axios.get(`/api/guilds/${guildID}/roles`)
      dispatch(setRolesSuccess(data))
    } catch (err) {
      dispatch(setRolesFailure(err))
    }
  }
}

export function setRolesSuccess (roles) {
  return {
    type: GET_ROLES.SUCCESS,
    payload: roles
  }
}

export function setRolesFailure (error) {
  return {
    type: GET_ROLES.FAILURE,
    payload: error
  }
}

export function setRolesBegin () {
  return {
    type: GET_ROLES.BEGIN
  }
}
