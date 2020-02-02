import {
  CHANGE_PAGE
} from '../constants/actions/page'

export function changePage (page) {
  return {
    type: CHANGE_PAGE,
    payload: page
  }
}
