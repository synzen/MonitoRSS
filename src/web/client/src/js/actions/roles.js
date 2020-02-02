import axios from 'axios'
import {
  GET_ROLES
} from '../constants/actions/roles'

export function fetchGuildRoles (guildID) {
  return dispatch => {
    dispatch(setRolesBegin())
    axios.get(`/api/guilds/${guildID}/roles`).then(({ data }) => {
      dispatch(setRolesSuccess(data))
    }).catch(err => {
      console.log(err)
      dispatch(setRolesFailure(err))
    })
  }
}

export function setRolesSuccess (roles) {
  return {
    type: GET_ROLES.SUCCESS,
    payload: roles
  }
}

export function setRolesFailure () {
  return {
    type: GET_ROLES.FAILURE
  }
}

export function setRolesBegin () {
  return {
    type: GET_ROLES.BEGIN
  }
}
