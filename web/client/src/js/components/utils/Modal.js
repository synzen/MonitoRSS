import React, { Component } from 'react'
import colors from '../../constants/colors'
import styled from 'styled-components'
import { lighten, darken } from 'polished'
import { Table, Modal, Popup, Button, Header, TransitionablePortal, Transition } from 'semantic-ui-react'
import PropTypes from 'prop-types'

const FixedWidthModal = styled(Modal)`
  width: 490px;
  color: ${colors.discord.text};
`

const ModalHeader = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  padding: 1em;
  background-color: #36393f;
  border-top-left-radius: 0.75em;
  border-top-right-radius: 0.75em;
  box-shadow: 0 2px 0px 0 rgba(0,0,0,0.2);
  width: 100%;
`

const ModalFooter = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  padding: 1em;
  background-color: ${colors.discord.darkButNotBlack};
  border-bottom-left-radius: 0.75em;
  border-bottom-right-radius: 0.75em;
  width: 100%;
`

const ModalBody = styled.div`
  position: relative;
  padding-top: ${props => props.hasHeader ? '5em' : 0};
  padding-bottom: ${props => props.hasFooter ? '5em' : 0};
`

function DiscordModal (props) {
  const { open } = props
  return (
    <TransitionablePortal
      duration={200}
      open={open}
      onOpen={() => setTimeout(() => document.body.classList.add('modal-fade-in'), 0)}
      transition={{ animation: 'scale', duration: 150 }}
    >
      <FixedWidthModal style={{ width: '490px' }} open onClose={(event) => {
        document.body.classList.remove('modal-fade-in');
        props.onClose()
      }} closeOnEscape>
        <Modal.Content style={{ overflow: 'hidden' }}>
          {props.header ? <ModalHeader>{props.header}</ModalHeader> : undefined}
          <ModalBody hasHeader={!!props.header} hasFooter={!!props.footer}>{props.children}</ModalBody>
          {props.footer ? <ModalFooter>{props.footer}</ModalFooter> : undefined}
        </Modal.Content>
      </FixedWidthModal>

    </TransitionablePortal>
  )
}

DiscordModal.propTypes = {
  children: PropTypes.node,
  header: PropTypes.node,
  footer: PropTypes.node,
  open: PropTypes.bool,
  onClose: PropTypes.func
}

export default DiscordModal
