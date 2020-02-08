import { ADD_SUBSCRIBER, DELETE_SUBSCRIBER, EDIT_SUBSCRIBER } from "js/constants/actions/subscribers";

function adding (state) {
  return state.loading[ADD_SUBSCRIBER.BEGIN]
}

function deleting (state) {
  return state.loading[DELETE_SUBSCRIBER.BEGIN]
}

function editing (state) {
  return state.loading[EDIT_SUBSCRIBER.BEGIN]
}

export default {
  adding,
  deleting,
  editing
}
