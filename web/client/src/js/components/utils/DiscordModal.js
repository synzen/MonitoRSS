import React from 'react'
import styled from 'styled-components'
import PropTypes from 'prop-types'
import posed, { PoseGroup } from 'react-pose'
import colors from '../../constants/colors'
// import { Scrollbars } from 'react-custom-scrollbars'
const TRANSITION_DURATION = 150

const Shade = posed.div({
  enter: { opacity: 1, transition: { duration: TRANSITION_DURATION } },
  exit: { opacity: 0, transition: { duration: TRANSITION_DURATION } }
})

const Modal = posed.div({
  enter: { scale: 1 },
  exit: { scale: 0.8 }
})

const StyledShade = styled(Shade)`
  background: rgba(0,0,0,0.85);
  position: fixed;
  display: flex;
  justify-content: center;
  align-items: center;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10000;
`

const StyledModal = styled(Modal)`
  position: relative;
  /* width: auto; */
  color: ${colors.discord.text};
  margin-right: 1em;
  margin-left: 1em;
  ${props => props.isImage || props.fullWidth ? '' : 'max-width: 490px'};
  ${props => props.isImage ? '' : 'width: 100%'};
`

const ModalHeader = styled.div`
  position: relative;
  z-index: 10;
  padding: 1em;
  background-color: #36393f;
  border-top-left-radius: 0.75em;
  border-top-right-radius: 0.75em;
  box-shadow: 0 2px 0px 0 rgba(0,0,0,0.2);
  max-width: 490px;
  width: 100%;
`

const ModalFooter = styled.div`
  padding: 1em;
  background-color: ${props => props.transparent ? 'transparent' : colors.discord.darkButNotBlack};
  border-bottom-left-radius: 0.75em;
  border-bottom-right-radius: 0.75em;
  ${props => props.fullWidth ? '' : 'max-width: 490px'};
  width: 100%;
`

const ModalBody = styled.div`
  position: relative;
  background: ${props => props.transparent ? 'transparent' : '#36393f'};
  padding: 1em;
  max-height: ${props => props.isImage ? '100%' : 'calc(100vh - 250px)'};
  overflow-y: auto;
  border-top-left-radius: ${props => props.hasHeader ? 0 : '0.75em'};
  border-top-right-radius: ${props => props.hasHeader ? 0 : '0.75em'};
  border-bottom-left-radius: ${props => props.hasFooter ? 0 : '0.75em'};
  border-bottom-right-radius: ${props => props.hasFooter ? 0 : '0.75em'};
  > div {
    flex-grow: 1;
  }
`

const ModalHeaderWrapper = styled.div`
  color: ${colors.discord.text};
  h4 {
    color: white;
    margin-bottom: 3px;
  }
`

class DiscordModal extends React.PureComponent {
  componentDidMount () {
    document.addEventListener('keydown', this.escFunction, false)
    window.addEventListener('popstate', this.popState)
  }

  componentWillUnmount () {
    document.removeEventListener('keydown', this.escFunction, false)
    window.removeEventListener('popstate', this.popState)
  }

  popState = e => {
    if (this.props.open) {
      e.preventDefault()
      this.props.onClose()
    }
  }

  escFunction = event => {
    if (event.keyCode === 27 && this.props.open) this.props.onClose()
  }

  render () {
    const props = this.props

    return (
      <PoseGroup>
        {this.props.open && [
          <StyledShade key='shade' onClick={e => {
            if (e.target === e.currentTarget && this.props.onClose) this.props.onClose()
          }}>
            <StyledModal key='dialog' isImage={this.props.isImage} fullWidth={this.props.fullWidth}>
              {props.header
                ? <ModalHeader>{props.header}</ModalHeader>
                : props.title || props.subtitle
                  ? <ModalHeader><ModalHeaderWrapper><h4>{props.title}</h4><p>{props.subtitle}</p></ModalHeaderWrapper></ModalHeader>
                  : null}
                  {/* <Scrollbars> */}
              <ModalBody isImage={this.props.isImage} transparent={props.transparentBody} hasHeader={!!props.header || !!props.title || !!props.subtitle} hasFooter={!!props.footer}><div>{props.children}</div></ModalBody>
              {/* </Scrollbars> */}
              {props.footer ? <ModalFooter transparent={props.transparentFooter} fullWidth={this.props.fullWidth}>{props.footer}</ModalFooter> : undefined}
            </StyledModal>
          </StyledShade>,
        ]}
      </PoseGroup>
    )
  }
}

DiscordModal.propTypes = {
  fullWidth: PropTypes.bool,
  onClose: PropTypes.func,
  open: PropTypes.bool,
  isImage: PropTypes.bool,
  header: PropTypes.oneOfType([ PropTypes.string, PropTypes.node ]),
  title: PropTypes.string,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  transparentBody: PropTypes.bool,
  footer: PropTypes.oneOfType([ PropTypes.node ])
}

export default DiscordModal
