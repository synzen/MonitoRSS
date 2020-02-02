import React from 'react'
import store from '../../store/index-store'
import styled from 'styled-components'
import { showModal, hideModal } from 'js/actions/modal'

const ModalImageContainer = styled.div`
  user-select: none;
  > img {
    display: block;
    max-width: 80vw;
    max-height: 80vh;
  }
  > a {
    display: inline-block;
    line-height: 30px;
    color: white !important;
    transition: opacity .15s ease;
    text-decoration: none;
    font-size: 14px;
    outline: 0;
    opacity: .5;
    &:hover {
      opacity: 1;
    }
  }
`

export default {
  show: (props, children) => {
    store.dispatch(showModal(props, children))
  },
  showImage: (src, alt) => {
    const props = {
      transparentBody: true,
      isImage: true
    }
    const children = (
      <ModalImageContainer>
        <img alt={alt} src={src} />
        <a href={src} target='_blank' rel='noopener noreferrer'>Open Original</a>
      </ModalImageContainer>
    )
    store.dispatch(showModal(props, children))
  },
  hide: () => {
    store.dispatch(hideModal())
  }
}
