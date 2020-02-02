import {
  CLEAR_ALL_ERRORS
} from '../actions/errors'

const initialState = {};

/**
 * @param {Object} state 
 * @param {Object} action
 * @param {string} action.type
 * @param {*} action.payload
 */
export default function(state = initialState, action) {
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
    /**
     * Set the error object if this is a _FAILURE action
     */
    const stateKey = action.type
    return { ...state, [stateKey]: action.payload }
  }
}
