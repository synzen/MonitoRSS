import { GET_FAILRECORDS } from 'js/constants/actions/failRecords'

const initialState = []

function failRecordsReducer (state = initialState, action) {
  switch (action.type) {
    case GET_FAILRECORDS.SUCCESS:
      return action.payload
    default:
      return state
  }
}

export default failRecordsReducer
