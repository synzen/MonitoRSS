import { SHOW_MODAL, HIDE_MODAL } from 'js/constants/actions/modal'

export function showModal (props, children) {
  return {
    type: SHOW_MODAL,
    payload: {
      props,
      children
    }
  }
}

export function hideModal () {
  return {
    type: HIDE_MODAL
  }
}
