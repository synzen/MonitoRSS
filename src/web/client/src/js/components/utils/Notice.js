import React from 'react'
import styled from 'styled-components'
import PropTypes from 'prop-types'

const Wrapper = styled.div`
  background-color: #f26522;
  color: white;
  flex-grow: 0;
  flex-shrink: 0;
  padding-left: 4px;
  padding-right: 28px;
  position: relative;
  text-align: center;
  z-index: 5000;
  line-height: 36px;
  font-size: 14px;
  /* height: 36px; */
`

const Dismiss = styled.div`
  cursor: pointer;
  background-position: 50% 55%;
  background-size: 10px 10px;
  height: 36px;
  position: absolute;
  right: 0;
  width: 36px;
  transition: opacity 0.2s;
  -webkit-app-region: no-drag;
  background: url(https://discordapp.com/assets/7731c77d99babca1a8faec204d98c380.svg) no-repeat;
`

class Notice extends React.PureComponent {
  render () {
    return (
      <Wrapper>
        <Dismiss />
        {this.props.children}
      </Wrapper>
    )
  }
}

Notice.propTypes = {
  children: PropTypes.node
}

export default Notice
