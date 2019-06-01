import React from 'react'
import colors from '../../../constants/colors'
import styled from 'styled-components'
import PropTypes from 'prop-types'

const ServerBlockAvatar = styled.div`
  display: inline-block;
  border-radius: 50%;
  background-image: ${props => `url('${props.src}')`};
  min-width: ${props => props.width};
  height: ${props => props.width};
  background-size: cover;
  background-position: top center;
  z-index: 1;
  background-blend-mode: screen;
  background-color: ${colors.discord.darkButNotBlack};
`

function DiscordAvatar (props) {
  return (
    <ServerBlockAvatar src={props.src} width={props.width} {...props} />
  )
}

DiscordAvatar.propTypes = {
  src: PropTypes.string,
  width: PropTypes.string
}

export default DiscordAvatar
