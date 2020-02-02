import axios from 'axios'
import {
  SET_USER
} from '../constants/actions/user'

export function fetchUser () {
  return dispatch => {
    dispatch(setUserBegin())
    axios.get('/api/users/@me').then(({ data, status }) => {
      dispatch(setUserSuccess(data))
    }).catch(err => {
      console.log(err)
      dispatch(setUserFailure(err))
    })
  }
}

export function setUserSuccess (user) {
  return {
    type: SET_USER.SUCCESS,
    payload: user
  }
}

export function setUserBegin () {
  return {
    type: SET_USER.BEGIN
  }
}

export function setUserFailure () {
  return {
    type: SET_USER.FAILURE
  }
}
