import styled from 'styled-components'
import colors from 'js/constants/colors'

const DiscordTextArea = styled.textarea`
  background-color: #18191c;
  border-radius: 0.25em;
  border-color: rgba(0,0,0,0.3);
  border-style: solid;
  border-width: 1px;
  padding: 1em;
  resize: none;
  color: ${colors.discord.white};
  transition: border-color 0.15s;
  width: 100%;
  &:focus, input:focus{
    outline: none;
  }
  min-height: ${1.15 * 7}em;
  height: ${props => (props.lineCount + 2) * 1.15}em;
  &::selection {
    background-color: #0078d7;
    color: ${colors.discord.white}
  }
  &:hover {
    border-color: rgba(0,0,0,0.8);
  }
  &:focus {
    border-color: ${colors.discord.blurple};
  }
`

export default DiscordTextArea
