import React from 'react'
import { toast, cssTransition } from 'react-toastify'
import styled from 'styled-components'

const PaddedText = styled.div`
  padding: 0.5em;
`

const DiscordAnim = cssTransition({
  enter: 'bounceIn',
  exit: 'minimizeOut',
  duration: 350
})

export default {
  success: (message, options) => {
    toast.success(<PaddedText>{message}</PaddedText>, {
      ...options,
      autoClose: 2500,
      transition: DiscordAnim,
      className: `discord-alert-success`
    })
  },
  error: (message, options) => {
    toast.error(<PaddedText>{message}</PaddedText>, {
      ...options,
      transition: DiscordAnim,
      className: 'discord-alert-error'
    })
  }
}
