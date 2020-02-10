import React, { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Button } from 'semantic-ui-react'
import styled from 'styled-components'
import TextArea from 'js/components/utils/TextArea'
import PopInButton from '../../../utils/PopInButton'
import feedSelectors from 'js/selectors/feeds'
import { fetchEditFeed } from 'js/actions/feeds'

const MessageArea = styled.div`
  margin-bottom: 1.5em;
`

const ActionButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  .ui.button {
    margin-left: 1em;
    margin-top: 1em;
  }
`

function TextSetting (props) {
  const { originalMessage } = props
  const [value, setValue] = useState(null)
  const feed = useSelector(feedSelectors.activeFeed)
  const editing = useSelector(feedSelectors.feedEditing)
  const dispatch = useDispatch()
  const noChanges = value === null || value === originalMessage || (!feed.text && !value)
  const textAreaVal = value || value === '' ? value : ''

  const save = () => {
    if (value === null || value === originalMessage) {
      return
    }
    const data = {
      text: value
    }
    dispatch(fetchEditFeed(feed.guild, feed._id, data))
  }

  const onUpdate = (newValue) => {
    if (newValue && newValue.length > 1950) {
      return
    }
    setValue(newValue)
    props.onUpdate(newValue)
  }

  return (
    <MessageArea>
      <TextArea onChange={e => onUpdate(e.target.value)} placeholder={originalMessage} value={textAreaVal} lineCount={textAreaVal ? textAreaVal.split('\n').length : 0} />
      <ActionButtons>
        <PopInButton content='Reset' basic inverted onClick={e => onUpdate(null)} pose={editing ? 'exit' : noChanges ? 'exit' : 'enter'} />
        <Button disabled={editing || noChanges} content='Save' color='green' onClick={save} />
      </ActionButtons>
    </MessageArea>
  )
}

export default TextSetting
