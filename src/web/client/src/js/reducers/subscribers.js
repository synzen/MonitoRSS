import { GET_SUBSCRIBERS, EDIT_SUBSCRIBER, ADD_SUBSCRIBER, DELETE_SUBSCRIBER } from 'js/constants/actions/subscribers'

const initialState = []

function subscribersReducer (state = initialState, action) {
  switch (action.type) {
    case GET_SUBSCRIBERS.SUCCESS:
      return action.payload
    case ADD_SUBSCRIBER.SUCCESS:
      const copy = [ ...state ]
      copy.push(action.payload)
      return copy
    case DELETE_SUBSCRIBER.SUCCESS:
      const deleteClone = [ ...state ]
      const deletedID = action.payload
      deleteClone.forEach((subscriber, index) => {
        if (subscriber.id === deletedID) {
          deleteClone.splice(index, 1)
        }
      })
      return deleteClone
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
