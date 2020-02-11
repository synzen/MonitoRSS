import axios from 'axios'
import FetchStatusActions from './utils/FetchStatusActions'
import { CREATE_FEEDBACK } from 'js/constants/actions/feedback'

export const {
  begin: createFeedbackBegin,
  success: createFeedbackSuccess,
  failure: createFeedbackFailure
} = new FetchStatusActions(CREATE_FEEDBACK)

export function fetchCreateFeedback (content) {
  return async dispatch => {
    try {
      dispatch(createFeedbackBegin())
      const { data } = await axios.post(`/api/feedback`, {
        content
      })
      dispatch(createFeedbackSuccess(data))
    } catch (err) {
      dispatch(createFeedbackFailure(err))
    }
  }
}
