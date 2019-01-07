import React, { Component } from 'react'
import colors from '../../constants/colors'
import { Popup } from 'semantic-ui-react'
import styled from 'styled-components'
import { lighten, darken, transparentize } from 'polished'
import PropTypes from 'prop-types'

const Button = styled.div`
  text-align: left;
  padding: 1.25em;
  margin: .5em 1em;
  border-radius: .25em;
  color: ${props => props.disabled ? darken(0.4, colors.discord.text) : props.active ? 'white' : lighten(0.45, colors.discord.darkButNotBlack)};
  background-color: ${props => props.disabled ? 'transparent' : props.active ? colors.discord.blurple : 'transparent'};
  /* width: 100%; */
  user-select: none;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'} !important;
  &:hover {
    user-select: none;
    text-decoration: none;
    /* color: white; */
    color: ${props => props.disabled ? darken(0.4, colors.discord.text) : props.active ? 'white' : lighten(0.65, colors.discord.darkButNotBlack)};
    background-color: ${props => props.disabled ? 'transparent' : props.active ? colors.discord.blurple : 'rgba(255, 255, 255, .15)'};
    cursor: pointer;
  }
  &:active {
    background-color: ${props => props.disabled ? 'transparent' : 'rgba(255, 255, 255, .25)'};
  }
`

function MenuButton (props) {
  return !props.disabled
    ? <Button {...props} >
      {props.children}
    </Button>
    : <Popup content='You must select a feed first!' inverted position='right center' trigger={
      <Button {...props} >
        {props.children}
      </Button>} />
}

MenuButton.propTypes = {
  children: PropTypes.node,
  disabled: PropTypes.bool
}

export default MenuButton
