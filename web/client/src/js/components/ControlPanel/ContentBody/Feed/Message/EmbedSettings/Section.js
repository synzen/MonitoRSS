import React from 'react'
import { withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import { changePage } from 'js/actions/index-actions'
import { Input, Button, Dropdown, Form, Popup } from 'semantic-ui-react'
import styled from 'styled-components'
import pages from 'js/constants/pages'
import SectionItemTitle from 'js/components/utils/SectionItemTitle'
import posed from 'react-pose'
import PropTypes from 'prop-types'
import { SketchPicker } from 'react-color'

const mapStateToProps = state => {
  return {
    guildId: state.guildId,
    feedId: state.feedId,
    feeds: state.feeds,
    csrfToken: state.csrfToken
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setToThisPage: () => dispatch(changePage(pages.MESSAGE))
  }
}

const SettingSectionHead = styled.div`
  align-items: center;
  padding: 1em;
  display: flex;
  background: rgba(44,47,53, 0.4);
  cursor: pointer;
  use-select: none !important;
  margin-bottom: 0.5em;
  margin-top: 0.5em;
  > label {
    margin-left: 1em;
    use-select: none !important;
  }
`

const SettingSectionBodyStyles = styled.div`
  height: 0;
  user-select: none;
`

const SettingSectionBody = posed(SettingSectionBodyStyles)({
  enter: { height: '100%' },
  exit: { height: 0 }
})

const InputWithButtonGroup = styled.div`
  display: flex;
  > .ui.input {
    flex-grow: 1;
    > input {
      width: 100% !important;
      border-top-right-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
    }
  }
  .ui.button {
    border-top-left-radius: 0 !important;
    border-bottom-left-radius: 0 !important;
  }
`

const DiscordColorPicker = styled(SketchPicker)`
  /* position: absolute; */
  background: #36393f !important;
  > div:last-child {
    display: none !important;
    border-top: 1px solid rgba(0, 0, 0, .3) !important;
  }
  input {
    box-shadow: none !important;
    background: rgba(0,0,0,.1);
    border-color: rgba(0,0,0,.3) !important;
    color: #f6f6f7;
    border-radius: 3px;
    border-style: solid !important;
    border-width: 1px !important;
    transition: border .15s ease;
    font-family: Whitney;
    ::selection {
      color: #f6f6f7;
      background-color: #0078d7;
    }
  }
  span {
    color: white !important;
  }
`

function numberToColour (number) {
  const r = (number & 0xff0000) >> 16
  const g = (number & 0x00ff00) >> 8
  const b = (number & 0x0000ff)
  return { r, g, b }
}

function ColorPicker (props) {
  return (
    <InputWithButtonGroup>
      <Input value={props.value || ''} />
      <Button.Group>
        <Popup
          style={{ background: 'transparent' }}
          inverted
          hoverable
          position='bottom left'
          basic
          on='focus'
          trigger={<Button icon='eyedropper' />}
        >
          <DiscordColorPicker color={numberToColour(props.value)} onChange={(color, event) => {
            props.onUpdate(props.variable, ((color.rgb.r << 16) + (color.rgb.g << 8) + color.rgb.b).toString()) // Convert to integer, then to string
          }} />
        </Popup>
        <Button icon='x' disabled={!props.value} onClick={e => props.onUpdate(props.variable, '')} />
      </Button.Group>
    </InputWithButtonGroup>
  )
}

class Section extends React.Component {
  constructor () {
    super()

    this.state = {
      visible: false,
      overflow: 'hidden'
    }
  }

  render () {
    const { inputs, onUpdate, name } = this.props
    const body = []
    if (inputs) {
      for (let i = 0; i < inputs.length; ++i) {
        const input = inputs[i]
        const disabled = input.condition === undefined ? false : !input.condition
        body.push(
          <Form.Field key={i}>
            <label>{input.label}</label>
            { input.textarea
              ? <textarea value={input.value} onChange={e => onUpdate(input.variable, e.target.value)} disabled={disabled} />
              : input.dropdown
                ? <Dropdown selection fluid options={input.options} onChange={(e, data) => onUpdate(input.variable, data.value)} value={input.value || 'none'} disabled={disabled} />
                : input.color
                  ? <ColorPicker value={input.value} onUpdate={onUpdate} variable={input.variable} />
                  : <input value={input.value} onChange={e => onUpdate(input.variable, e.target.value)} disabled={disabled} />
            }
          </Form.Field>
        )
      }
    }
    return (
      <div>
        <SettingSectionHead onClick={e => this.setState({ visible: !this.state.visible, overflow: 'hidden' })}>
          <Button size='mini' icon={this.state.visible ? 'caret up' : 'caret down'} />
          <SectionItemTitle>{name}</SectionItemTitle>
        </SettingSectionHead>
        <SettingSectionBody pose={this.state.visible ? 'enter' : 'exit'} style={{ overflow: this.state.overflow }} onPoseComplete={() => this.state.visible ? this.setState({ overflow: 'visible' }) : null}>
          {this.props.body || <Form>{body}</Form>}
        </SettingSectionBody>
      </div>
    )
  }
}

Section.propTypes = {
  name: PropTypes.string.isRequired,
  inputs: PropTypes.array,
  onUpdate: PropTypes.func,
  body: PropTypes.node
}

ColorPicker.propTypes = {
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
  onUpdate: PropTypes.func,
  variable: PropTypes.string,
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Section))
