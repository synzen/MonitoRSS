import { GET_SCHEDULE } from 'js/constants/actions/schedules'

const initialState = {}

function schedulesReducer (state = initialState, action) {
  switch (action.type) {
    case GET_SCHEDULE.SUCCESS:
      return {
        ...state,
        [action.payload.feedID]: action.payload.data
      }
    default:
      return state
  }
}


export default schedulesReducer
