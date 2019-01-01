import { UPDATE_GUILD, TEST_ACTION } from '../constants/action-types'
import update from 'immutability-helper'

const initialState = {
  testVal: 'Initial State Value'
}

// Always use immutability-helper for updating nested objects like guildRss

function rootReducer (state = initialState, action) {
  if (action.type === TEST_ACTION) {
    return update(state, { testVal: { $set: action.payload } })
  } else if (action.type === UPDATE_GUILD) {
    return update(state, { guildRss: { $set: action.payload } })
  }
  return state
}

export default rootReducer
