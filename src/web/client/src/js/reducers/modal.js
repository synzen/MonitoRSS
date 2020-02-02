import { SHOW_MODAL, HIDE_MODAL } from "js/constants/actions/modal";

const initialState = {
  open: false,
  children: null,
  props: null
}

function modalReducer (state = initialState, action) {
  switch (action.type) {
    case SHOW_MODAL:
      return {
        open: true,
        children: action.payload.children,
        props: action.payload.props
      }
    case HIDE_MODAL:
      return {
        open: false
      }
    default:
      return state
  }
}

export default modalReducer
