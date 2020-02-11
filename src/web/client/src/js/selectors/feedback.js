import { CREATE_FEEDBACK } from 'js/constants/actions/feedback'

function feedbackSaving (state) {
  return state.loading[CREATE_FEEDBACK.BEGIN]
}

export default {
  feedbackSaving
}
