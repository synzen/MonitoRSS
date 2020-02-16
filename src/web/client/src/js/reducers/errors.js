import React from 'react'
import {
  CLEAR_ALL_ERRORS
} from '../actions/errors'
import toast from 'js/components/ControlPanel/utils/toast'

const initialState = {}

/**
 * @param {Object} state
 * @param {Object} action
 * @param {string} action.type
 * @param {*} action.payload
 */
export default function errorReducer (state = initialState, action) {
  if (!action.type) {
    return state
  }

  if (action.type === CLEAR_ALL_ERRORS) {
    return {}
  }

  const isFailure = action.type.endsWith('_FAILURE')
  const isSuccess = action.type.endsWith('_SUCCESS')

  if (!isFailure && !isSuccess) {
    return state
  }

  if (isSuccess) {
    /**
     * Remove the error object if this is a _SUCCESS action
     * by creating a clone to maintain immutability
     */
    const stateKey = action.type.replace('_SUCCESS', '_FAILURE')
    return Object.keys(state).reduce((newState, key) => {
      if (key !== stateKey) {
        newState[key] = state[key]
      }
      return newState
    }, {})
  } else {
    const error = action.payload
    if (error.response) {
      /*
       * The request was made and the server responded with a
       * status code that falls out of the range of 2xx
       */
      console.log(error.response.data)
      console.log(error.response.status)
      console.log(error.response.headers)
      if (error.response.status === 304) {
        toast.success('No changes detected')
      } else if (error.response.data.message) {
        const details = error.response.data.errors
        if (details) {
          details.join(<br />)
        }
        toast.error(
          <div>
            {error.response.data.message}
            {details
              ? <div><br />{details}</div>
              : null}
          </div>)
      } else {
        toast.error('Unknown error')
      }
    } else {
      // Something happened in setting up the request and triggered an Error
      toast.error(error.message)
      console.log('Error', error.message)
    }

    /**
     * Set the error object if this is a _FAILURE action
     */
    const stateKey = action.type
    return { ...state, [stateKey]: action.payload }
  }
}
