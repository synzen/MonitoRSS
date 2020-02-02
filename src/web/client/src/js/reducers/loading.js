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

  const isBeginning = action.type.endsWith('_BEGIN')

  if (isBeginning) {
    return {
      ...state,
      [action.type]: true
    }
  }

  const isFailure = action.type.endsWith('_FAILURE')
  const isSuccess = action.type.endsWith('_SUCCESS')

  if (isFailure || isSuccess) {
    const stateKey = action.type.replace(/_FAILURE|_SUCCESS/, '_BEGIN')
    const copy = { ...state }
    delete copy[stateKey]
    return copy
  }

  return state
}
