import {
  GET_ARTICLES
} from '../constants/actions/feeds'

const initialState = []

function articlesReducer (state = initialState, action) {
  switch (action.type) {
    case GET_ARTICLES.SUCCESS:
      return action.payload
    default:
      return state
  }
}

export default articlesReducer
