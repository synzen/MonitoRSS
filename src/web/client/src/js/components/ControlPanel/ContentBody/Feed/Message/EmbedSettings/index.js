import React, { useState, useEffect, useReducer } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Input, Popup, Button, Divider, Checkbox, Icon } from 'semantic-ui-react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import toast from '../../../../utils/toast'
import SectionTitle from 'js/components/utils/SectionTitle'
import SectionItemTitle from 'js/components/utils/SectionItemTitle'
import PopInButton from '../../../../utils/PopInButton'
import TextArea from 'js/components/utils/TextArea'
import Wrapper from 'js/components/utils/Wrapper'
import embedPropertiesNames from 'js/constants/embed.js'
import posed, { PoseGroup } from 'react-pose'
import { Scrollbars } from 'react-custom-scrollbars'
import Section from './Section'
import feedSelectors from 'js/selectors/feeds'
import { fetchEditFeed } from 'js/actions/feeds'
import fastEqual from 'fast-deep-equal'
import embedsReducer from './embedsReducer'
import { setProperty, setFieldProperty, addField, setEmbeds, removeField } from './embedsActions'

const ActionButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
  .ui.button {
    margin-left: 1em;
  }
`

const EmbedFieldsWrapper = styled.div`
  /* display: flex; */
  /* overflow-x: auto; */
  /* padding: 0 0 1em; */
  overflow-y: hidden;
  white-space: nowrap;
  scrollbar-width: thin;
  height: 430px;
  width: 100%;
`

const EmbedFieldsWrapperInner = styled.div`
  display: flex;
  padding: 0 0 1em;
  height: 410px;
`

const EmbedFieldBoxStyles = styled(Wrapper)`
  display: inline-block;
  flex-shrink: 0;
  margin-right: 30px;
  /* height: 100%; */
  overflow: hidden;
  > div {
    width: 260px; /* Counts the 20px padding from Wrapper */
  }
`

const EmbedFieldBox = posed(EmbedFieldBoxStyles)({
  enter: { opacity: 1, width: '300px', transition: { duration: 200 } },
  exit: { opacity: 0, width: 0, transition: { duration: 200 } }
})

const AddEmbedFieldBox = styled(EmbedFieldBoxStyles)`
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  margin-right: 0;
  width: 300px;
  height: 100%;
`

function pruneFields (fields) {
  const fieldsCopy = [...fields]
  for (let i = fieldsCopy.length - 1; i >= 0; --i) {
    const fieldCopy = { ...fieldsCopy[i] }
    if (!fieldCopy.name || !fieldCopy.value) {
      fieldsCopy.splice(i, 1)
    }
    fieldsCopy[i] = fieldCopy
  }
  return fieldsCopy
}

function pruneEmbed (embed) {
  const embedCopy = { ...embed }
  for (const key in embedCopy) {
    const embedValue = embedCopy[key]
    if (!embedValue) {
      delete embedCopy[key]
    }
    // Fields is an array
    if (key === 'fields') {
      const prunedFields = pruneFields(embedValue)
      if (prunedFields.length === 0) {
        delete embedCopy[key]
      } else {
        embedCopy[key] = prunedFields
      }
    }
  }
  return embedCopy
}

function pruneEmbeds (embeds) {
  const embedsCopy = [...embeds]
  for (let i = embedsCopy.length - 1; i >= 0; --i) {
    const embedCopy = { ...embedsCopy[i] }
    const prunedEmbed = pruneEmbed(embedCopy)
    embedsCopy[i] = prunedEmbed
    if (Object.keys(prunedEmbed).length === 0) {
      embedsCopy.splice(i, 1)
    }
  }
  return embedsCopy
}

function convertEmbedToPayload (payload) {
  // Take care of fields
  if (payload.fields) {
    const fields = [ ...payload.fields ]
    for (let i = fields.length - 1; i >= 0; --i) {
      const field = fields[i]
      if (!field.name || !field.value) {
        toast.error(`Each embed field must have the name and value specified!`)
        return null
      } else if (field.name && field.value && fields[i].inline === false) {
        // Embed fields are false by default, so delete the key
        const newField = { ...field }
        delete newField.inline
        fields[i] = newField
      }
    }
    payload.fields = fields
  }
  return payload
}

function EmbedSettings (props) {
  const { onUpdate } = props
  const feed = useSelector(feedSelectors.activeFeed)
  const editing = useSelector(feedSelectors.feedEditing)
  const [index, setIndex] = useState(0)
  const [unsaved, setUnsaved] = useState(false)
  const dispatch = useDispatch()
  const originalEmbeds = feed.embeds
  const [embeds, embedsDispatch] = useReducer(embedsReducer, originalEmbeds)

  useEffect(() => {
    discardChanges()
  }, [feed, originalEmbeds])

  useEffect(() => {
    const prunedEmbeds = pruneEmbeds(embeds)
    const prunedOriginalEmbeds = pruneEmbeds(feed.embeds)
    if (!fastEqual(prunedEmbeds, prunedOriginalEmbeds)) {
      if (!unsaved) {
        setUnsaved(true)
      }
    } else {
      if (unsaved) {
        setUnsaved(false)
      }
    }
  }, [embeds, unsaved, feed.embeds])

  useEffect(() => {
    onUpdate(embeds)
  }, [embeds, onUpdate])

  const prevIndex = () => {
    if (index <= 0 || unsaved) return
    setIndex(index - 1)
  }

  const nextIndex = () => {
    if (index >= 8 || unsaved) return
    setIndex(index + 1)
  }

  const onPropertyUpdate = (property, value) => {
    embedsDispatch(setProperty(index, property, value))
  }

  const onUpdateField = (fieldIndex, property, value) => {
    embedsDispatch(setFieldProperty(index, fieldIndex, property, value))
  }

  const removeEmbedField = (fieldIndex) => {
    embedsDispatch(removeField(index, fieldIndex))
  }

  const addEmbedField = () => {
    embedsDispatch(addField(index))
  }

  const discardChanges = () => {
    setIndex(0)
    embedsDispatch(setEmbeds(feed.embeds))
  }

  const apply = async () => {
    if (!unsaved) {
      return
    }
    const prunedEmbeds = pruneEmbeds(embeds)
    for (let i = 0; i < prunedEmbeds.length; ++i) {
      const cleansed = convertEmbedToPayload({ ...prunedEmbeds[i] })
      if (!cleansed) {
        return
      }
      prunedEmbeds[i] = cleansed
    }
    await dispatch(fetchEditFeed(feed.guild, feed._id, {
      embeds: prunedEmbeds
    }))
  }

  const hasWebhooks = !!feed.webhook
  const originalValues = originalEmbeds[index] || {}
  const valuesToUse = {}
  for (const key in embedPropertiesNames) {
    const propertyName = embedPropertiesNames[key]
    const thisEmbed = embeds[index]
    valuesToUse[propertyName] = thisEmbed && thisEmbed[propertyName] === '' ? '' : thisEmbed && propertyName === 'color' && thisEmbed[propertyName] === 0 ? '0' : thisEmbed ? (thisEmbed[propertyName] || originalValues[propertyName] || '') : ''
  }

  const fieldElements = []
  const thisEmbed = embeds[index]
  if (thisEmbed && thisEmbed.fields) {
    for (let i = 0; i < thisEmbed.fields.length; ++i) {
      const field = thisEmbed.fields[i]
      fieldElements.push(
        <EmbedFieldBox key={i}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Field {i + 1}
              <Button basic content='Remove' onClick={e => removeEmbedField(i)} />
            </div>
            <Divider />
            <SectionItemTitle style={{ display: 'block' }}>Title</SectionItemTitle>
            <Input fluid value={field.name || ''} style={{ marginBottom: '1em', marginTop: '1em' }} onChange={e => onUpdateField(i, 'name', e.target.value)} />
            <SectionItemTitle style={{ display: 'block' }}>Value</SectionItemTitle>
            <TextArea value={field.value || ''} style={{ marginTop: '1em' }} onChange={e => onUpdateField(i, 'value', e.target.value)} />
            <div style={{ marginTop: '1em' }}>
              <Checkbox label='Inline' checked={field.inline || false} onChange={(e, data) => onUpdateField(i, 'inline', data.checked)} />
            </div>
          </div>
        </EmbedFieldBox>
      )
    }
  }

  return (
    <div>
      <SectionTitle heading='Embeds' subheading='Embeds are fancy boxes that can be shown under your message. Placeholders may also be used here.' sideComponent={
        <Button.Group>
          <Button disabled={index === 0 || unsaved} icon='chevron left' onClick={prevIndex} size='large' />
          <Button.Or text={`${index + 1}/${index >= originalEmbeds.length - 1 ? originalEmbeds.length : index + 2}`} />
          {!hasWebhooks
            ? <Popup
              inverted
              content='Only feeds with webhooks attached may use more embeds'
              trigger={<span><Button disabled icon='add' circular size='large' /></span>}
            />
            : <Button disabled={index >= 8 || index >= originalEmbeds.length} icon={index >= originalEmbeds.length - 1 ? 'add' : 'chevron right'} onClick={nextIndex} size='large' />
          }
        </Button.Group>} />
      <Section
        name='Author'
        inputs={[
          { label: 'Text', variable: embedPropertiesNames.authorName, value: valuesToUse[embedPropertiesNames.authorName] },
          { label: 'Icon URL', variable: embedPropertiesNames.authorIconURL, value: valuesToUse[embedPropertiesNames.authorIconURL], condition: !!valuesToUse[embedPropertiesNames.authorName] },
          { label: 'URL', variable: embedPropertiesNames.authorURL, value: valuesToUse[embedPropertiesNames.authorURL], condition: !!valuesToUse[embedPropertiesNames.authorName] }
        ]}
        onUpdate={onPropertyUpdate}
      />
      <Section
        name='Title'
        inputs={[
          { label: 'Text', variable: embedPropertiesNames.title, value: valuesToUse[embedPropertiesNames.title] },
          { label: 'URL', variable: embedPropertiesNames.url, value: valuesToUse[embedPropertiesNames.url], condition: !!valuesToUse[embedPropertiesNames.title] }
        ]}
        onUpdate={onPropertyUpdate}
      />
      <Section
        name='Description'
        inputs={[
          { label: 'Text', variable: embedPropertiesNames.description, textarea: true, value: valuesToUse[embedPropertiesNames.description] }
        ]}
        onUpdate={onPropertyUpdate}
      />
      <Section
        name='Images'
        inputs={[
          { label: 'Image URL', variable: embedPropertiesNames.imageURL, value: valuesToUse[embedPropertiesNames.imageURL] },
          { label: 'Thumbnail URL', variable: embedPropertiesNames.thumbnailURL, value: valuesToUse[embedPropertiesNames.thumbnailURL] }
        ]}
        onUpdate={onPropertyUpdate}
      />
      <Section
        name='Footer'
        inputs={[
          { label: 'Text', variable: embedPropertiesNames.footerText, value: valuesToUse[embedPropertiesNames.footerText] },
          { label: 'Icon URL', variable: embedPropertiesNames.footerIconURL, values: valuesToUse[embedPropertiesNames.footerIconURL], condition: !!valuesToUse[embedPropertiesNames.footerText] },
          { label: 'Timestamp', variable: embedPropertiesNames.timestamp, dropdown: true, options: [{ text: 'None', value: 'none' }, { text: 'article', value: 'article' }, { text: 'now', value: 'now' }], value: valuesToUse[embedPropertiesNames.timestamp] }
        ]}
        onUpdate={onPropertyUpdate}
      />
      <Section
        name='Color'
        inputs={[
          { label: 'Number', variable: embedPropertiesNames.color, color: true, value: valuesToUse[embedPropertiesNames.color] }
        ]}
        onUpdate={onPropertyUpdate}
      />
      <Section
        name='Fields'
        body={
          <EmbedFieldsWrapper>
            <Scrollbars>
              <EmbedFieldsWrapperInner>
                <PoseGroup>
                  {fieldElements}
                </PoseGroup>
                <div>
                  <AddEmbedFieldBox key={thisEmbed && thisEmbed.fields ? thisEmbed.fields.length : 0} onClick={addEmbedField}>
                    <Icon name='add' size='big' />
                  </AddEmbedFieldBox>
                </div>
              </EmbedFieldsWrapperInner>
            </Scrollbars>
          </EmbedFieldsWrapper>
        }
      />
      <ActionButtons>
        <PopInButton key='discard-changes-embed' content='Reset' basic inverted onClick={discardChanges} pose={editing ? 'exit' : unsaved ? 'enter' : 'exit'} />
        <Button disabled={editing || !unsaved} content='Save' color='green' onClick={apply} />
      </ActionButtons>
    </div>
  )
}

EmbedSettings.propTypes = {
  onUpdate: PropTypes.func
}

export default EmbedSettings
