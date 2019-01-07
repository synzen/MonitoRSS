import React, { Component } from 'react'
import colors from '../../constants/colors'
import styled from 'styled-components'
import { lighten } from 'polished'
import PropTypes from 'prop-types'

const ServerBackground = styled.div`
  position: relative;
  background-color:  ${lighten(0.02, colors.discord.notQuiteblack)};
  /* background: linear-gradient(0deg, pink 50%, cyan 50%); */
  width: 100%;
  height: 25.5em;
  /* z-index: 10; */
`

const ServerBlock = styled.div`
  display: flex;
  flex-direction: row;
  position: absolute;
  bottom: -7em;
  left: 7em;
  /* background: green; */
  height: 14em;
`

const ServerBlockAvatar = styled.div`
  border-radius: 50%;
  background-image: ${props => `url('${props.src}')`};
  width: ${props => props.width};
  height: ${props => props.width};
  background-size: cover;
  background-position: top center;
  z-index: 1;
  background-blend-mode: screen;
  background-color: ${colors.discord.darkButNotBlack};
`

function DiscordAvatar (props) {
  return (
    <ServerBlockAvatar src={props.src} width={props.width} />
  )
}

DiscordAvatar.propTypes = {
  src: PropTypes.string,
  width: PropTypes.string
}

export default DiscordAvatar
