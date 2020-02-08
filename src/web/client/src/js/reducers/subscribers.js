import { GET_SUBSCRIBERS, EDIT_SUBSCRIBER } from 'js/constants/actions/subscribers'

const initialState = []

function subscribersReducer (state = initialState, action) {
  switch (action.type) {
    case GET_SUBSCRIBERS.SUCCESS:
      return action.payload
    case EDIT_SUBSCRIBER.SUCCESS:
      const clone = [...state]
      const updated = action.payload
      clone.forEach((subscriber, index) => {
        if (subscriber.id === updated.id) {
          clone[index] = updated
        }
      })
      return clone
    default:
      return state
  }
}

export default subscribersReducer
