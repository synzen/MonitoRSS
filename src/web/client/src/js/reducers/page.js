import {
  CHANGE_PAGE
} from '../constants/actions/page'
import pages from '../constants/pages'

const initialState = pages.DASHBOARD

export default function pageReducer (state = initialState, action) {
  switch (action.type) {
    case CHANGE_PAGE:
      return action.payload
    default:
      return state
  }
}
