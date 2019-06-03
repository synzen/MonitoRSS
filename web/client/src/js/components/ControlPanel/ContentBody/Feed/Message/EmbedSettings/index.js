import React from 'react'
import { withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import { changePage } from 'js/actions/index-actions'
import { Input, Popup, Button, Divider, Checkbox, Icon } from 'semantic-ui-react'
import styled from 'styled-components'
import pages from 'js/constants/pages'
import colors from 'js/constants/colors'
import toast from '../../../../utils/toast'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import SectionItemTitle from 'js/components/utils/SectionItemTitle'
import PopInButton from '../../../../utils/PopInButton'
import TextArea from 'js/components/utils/TextArea'
import Wrapper from 'js/components/utils/Wrapper'
import PropTypes from 'prop-types'
import embedPropertiesNames from 'js/constants/embed.js'
import posed, { PoseGroup } from 'react-pose'
import axios from 'axios'
import { Scrollbars } from 'react-custom-scrollbars'
import Section from './Section'

const EMBED_FIELD_LIMITS = {
  name: 256,
  value: 1024
}

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

const SelectionControls = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1.5em;
  margin-bottom: 1.5em;
  font-size: 125%;
  > div:nth-child(even) {
    display: flex;
    align-content: center;
    > h5 {
      margin: 0;
      color: ${colors.discord.white};
    }
    > h6 {
      padding-left: 1em;
      padding-right: 1em;
      margin: 0;
      color: ${colors.discord.text};
    }
  }
`

const ActionButtons = styled.div`
  display: flex;
  justify-content: flex-end;
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

const EMBED_FIELD_KEYS = ['title', 'value', 'inline']

class EmbedSettings extends React.Component {
  constructor () {
    super()

    this.state = {
      index: 0,
      unsaved: false,
      saving: false,
      embeds: [],
      showAuthorSection: false
    }

  }

  componentDidMount () {
    this.setState({ embeds: JSON.parse(JSON.stringify(this.props.embedsOriginal)) })
  }

  componentDidUpdate (prevProps) {
    const { embedsOriginal } = this.props
    // Compare the original embeds
    if (prevProps.embedsOriginal.length > 0 && embedsOriginal.length === 0) return this.setState({ index: 0, embeds: [], unsaved: false })
    else if (prevProps.embedsOriginal.length === 0 && embedsOriginal.length > 0) return this.setState({ index: 0, embeds: JSON.parse(JSON.stringify(embedsOriginal)), unsaved: false })
    else {
      const lenToLoop = embedsOriginal.length > prevProps.embedsOriginal.length ? embedsOriginal.length : prevProps.embedsOriginal.length
      for (let i = 0; i < lenToLoop; ++i) {
        const prevOriginalEmbed = prevProps.embedsOriginal[i]
        const thisOriginalEmbed = embedsOriginal[i]
        if (!prevOriginalEmbed && !thisOriginalEmbed) continue // This is a new embed the user wants to add but hasn't applied - it's only available in this state
        else if ((!prevOriginalEmbed && thisOriginalEmbed) || (prevOriginalEmbed && !thisOriginalEmbed)) {
          // This is a new embed that the user has applied and is in effect, OR an embed that was just deleted
          const newState = { embeds: JSON.parse(JSON.stringify(embedsOriginal)), unsaved: false }
          if (this.state.index > embedsOriginal.length) newState.index = 0
          return this.setState(newState)
        }

        // String properties
        for (const property in embedPropertiesNames) {
          const propertyName = embedPropertiesNames[property]
          // Check if they exist first since this may be a new embed that doesn't exist in either of them
          if (prevOriginalEmbed[propertyName] !== thisOriginalEmbed[propertyName]) return this.setState({ embeds: JSON.parse(JSON.stringify(embedsOriginal)), unsaved: false })
        }

        // Fields
        if (!prevOriginalEmbed.fields && thisOriginalEmbed.fields) return this.setState({ embeds: JSON.parse(JSON.stringify(embedsOriginal)), unsaved: false })
        else if (prevOriginalEmbed.fields && !thisOriginalEmbed.fields) return this.setState({ embeds: JSON.parse(JSON.stringify(embedsOriginal)), unsaved: false })
        else if (prevOriginalEmbed.fields && thisOriginalEmbed.fields) {
          const prevOriginalEmbedFields = prevOriginalEmbed.fields
          const thisOriginalEmbedFields = thisOriginalEmbed.fields
          if ((!prevOriginalEmbedFields && thisOriginalEmbedFields) || (prevOriginalEmbedFields && !thisOriginalEmbedFields)) return this.setState({ embeds: JSON.parse(JSON.stringify(embedsOriginal)), unsaved: false })
          else if (prevOriginalEmbedFields && thisOriginalEmbedFields) {
            if (prevOriginalEmbedFields.length !== thisOriginalEmbedFields.length) return this.setState({ embeds: JSON.parse(JSON.stringify(embedsOriginal)), unsaved: false })
            else {
              for (let j = 0; j < prevOriginalEmbedFields.length; ++j) {
                const prevOriginalEmbedField = prevOriginalEmbedFields[j]
                const thisOriginalEmbedField = thisOriginalEmbedFields[j]
                for (const key of EMBED_FIELD_KEYS) {
                  if (prevOriginalEmbedField && thisOriginalEmbedField && prevOriginalEmbedField[key] !== thisOriginalEmbedField[key]) return this.setState({ embeds: JSON.parse(JSON.stringify(embedsOriginal)), unsaved: false })
                  else if ((!prevOriginalEmbedField && thisOriginalEmbedField) || (prevOriginalEmbedField && !thisOriginalEmbedField)) return this.setState({ embeds: JSON.parse(JSON.stringify(embedsOriginal)), unsaved: false })
                }
              }
            }
          }
        }
      }

      // Now check and update unsaved if necessary
      if (this.state.unsaved) return

      const originalEmbed = embedsOriginal[this.state.index]
      const thisEmbed = this.state.embeds[this.state.index]

      // String properties
      if (thisEmbed) {
        for (const property in embedPropertiesNames) {
          const propertyName = embedPropertiesNames[property]
          if (!originalEmbed) {
            if (thisEmbed[propertyName]) return this.setState({ unsaved: true }) // Check if any values exist to qualify it for unsaved as a new embed
          } else {
            if ((originalEmbed[propertyName] && thisEmbed[propertyName] && originalEmbed[propertyName] !== thisEmbed[propertyName])) return this.setState({ unsaved: true })
            else if (!originalEmbed[propertyName] && thisEmbed[propertyName]) return this.setState({ unsaved: true })
            else if (originalEmbed[propertyName] && !thisEmbed[propertyName]) return this.setState({ unsaved: true })
          }
        }
      }

      // Check the fields as well
      const originalEmbedFields = originalEmbed ? originalEmbed.fields : null
      const thisEmbedFields = thisEmbed ? thisEmbed.fields : null
      if (originalEmbedFields && !thisEmbedFields) return this.setState({ unsaved: true })
      else if (!originalEmbedFields && thisEmbedFields) {
        for (const field of thisEmbedFields) {
          if (field.title && field.value) return this.setState({ unsaved: true })
        }
      } else if (originalEmbedFields && thisEmbedFields) {
        for (let i = 0; i < originalEmbedFields.length; ++i) {
          const originalField = originalEmbedFields[i]
          const thisField = thisEmbedFields[i]
          for (const key of EMBED_FIELD_KEYS) {
            // Check if thisField exists since it may be deleted
            if (thisField && originalField[key] && thisField[key] && originalField[key] !== thisField[key]) return this.setState({ unsaved: true })
            else if (thisField && !originalField[key] && thisField[key]) return this.setState({ unsaved: true })
            else if (thisField && originalField[key] && !thisField[key]) return this.setState({ unsaved: true })
          }
        }
        if (originalEmbedFields.length !== thisEmbedFields.length) {
          // First condition checks if the user has deleted embeds here
          if (originalEmbedFields.length > thisEmbedFields.length) return this.setState({ unsaved: true })
          else {
            // Now the shorter one is original, so there must be added embed fields to thisEmbedFields. They may have be empty, so manual checks are required below.
            for (let i = originalEmbedFields.length; i < thisEmbedFields.length; ++i) {
              const thisField = thisEmbedFields[i]
              if (thisField.title && thisField.value) return this.setState({ unsaved: true })
            }
          }
          return
        }
      }
    }
  }

  prevIndex = () => {
    if (this.state.index <= 0 || this.state.unsaved) return
    this.setState({ index: this.state.index - 1 })
  }

  nextIndex = () => {
    if (this.state.index >= 8 || this.state.unsaved) return
    this.setState({ index: this.state.index + 1 })
  }

  onUpdate = (property, value) => {
    const { embedsOriginal } = this.props
    const embeds = [ ...this.state.embeds ]
    let currentEmbed = embeds[this.state.index] ? { ...embeds[this.state.index] } : null
    if (!currentEmbed) {
      embeds.push({ [property]: value })
      currentEmbed = embeds[embeds.length - 1]
    } else {
      currentEmbed[property] = value
      embeds[this.state.index] = currentEmbed
    }

    if (property === embedPropertiesNames.timestamp && value === 'none') {
      if ((!this.state.embeds[this.state.index] || !this.state.embeds[this.state.index][property]) && (!embedsOriginal[this.state.index] || !embedsOriginal[this.state.index][property])) return this.state.unsaved === true ? this.setState({ unsaved: false }) : null // No change
      else if (currentEmbed[property] && (!embedsOriginal[this.state.index] || !embedsOriginal[this.state.index][property])) { // 'none' matches a undefined value for timestamp in the embed
        delete embeds[this.state.index][property]
        this.setState({ embeds, unsaved: false })
      } else {
        embeds[this.state.index][property] = value
        this.setState({ embeds, unsaved: true })
      }
    } else {
      const same = (embedsOriginal[this.state.index] && ((embedsOriginal[this.state.index][property] === value) || (!embedsOriginal[this.state.index][property] && !value))) || (!embedsOriginal[this.state.index] && !value)
      this.setState({ embeds, unsaved: !same })
    }
    this.props.onUpdate(this.state.index, property, value)
  }

  onUpdateField = (fieldIndex, property, value) => {
    if (EMBED_FIELD_LIMITS[property] && value.length > EMBED_FIELD_LIMITS[property]) return
    const { embedsOriginal } = this.props
    const embeds = [ ...this.state.embeds ]
    let currentEmbed = embeds[this.state.index] ? { ...embeds[this.state.index] } : null
    if (!currentEmbed) {
      if (fieldIndex !== 0) throw new Error(`Cannot edit none-zero field index ${fieldIndex} for an embed that does not exist`)
      embeds.push({ fields: [{ [property]: value }] })
      currentEmbed = embeds[embeds.length - 1]
    } else {
      const fields = currentEmbed.fields
      if (fieldIndex > fields.length) throw new Error(`Cannot edit field index ${fieldIndex} that is greater than fields.length`)
      if (!fields[fieldIndex]) fields.push({ [property]: value })
      else fields[fieldIndex][property] = value
      embeds[this.state.index] = currentEmbed
    }
    let same = true
    if (embedsOriginal[this.state.index] && embedsOriginal[this.state.index].fields && embedsOriginal[this.state.index].fields[fieldIndex]) {
      // If the original field exists
      const originalField = embedsOriginal[this.state.index].fields[fieldIndex]
      if (property === 'inline') {
        if ((!originalField[property] && !value) || (originalField[property] && value)) same = true
        else same = false
      } else {
        if (originalField[property] && value && originalField[property] !== value) same = false
        else if ((!originalField[property] && value) || (originalField[property] && !value)) {
          same = false
        }
      }
    } else {
      if (value && (!embedsOriginal[this.state.index] || !embedsOriginal[this.state.index].fields || !embedsOriginal[this.state.index].fields[fieldIndex])) same = false // This must be a new field
    }

    this.setState({ embeds, unsaved: !same })
    this.props.onUpdate(this.state.index, 'fields', currentEmbed.fields)
  }

  addEmbedField = () => {
    const embeds = [ ...this.state.embeds ]
    let currentEmbed = embeds[this.state.index] ? { ...embeds[this.state.index] } : null
    if (!currentEmbed) {
      // Pushing a new embed
      embeds.push({ fields: [{}] })
      currentEmbed = embeds[embeds.length - 1]
    } else {
      if (currentEmbed.fields && currentEmbed.fields.length >= 25) return
      if (!currentEmbed.fields) currentEmbed.fields = []
      currentEmbed.fields.push({})
      embeds[this.state.index] = currentEmbed
    }

    this.setState({ embeds })
    this.props.onUpdate(this.state.index, 'fields', currentEmbed.fields)
  }

  removeEmbedField = fieldIndex => {
    const embeds = [ ...this.state.embeds ]
    const currentEmbed = embeds[this.state.index] // The currentEmbed must exist if removeEmbedField is called
    currentEmbed.fields.splice(fieldIndex, 1)
    this.setState({ embeds })
    this.props.onUpdate(this.state.index, 'fields', currentEmbed.fields)
  }

  discardChanges = () => {
    const { embedsOriginal, resetEmbedProperties } = this.props
    resetEmbedProperties() // Use the prop function since calling all props.onUpdate multiple times is unnecessary
    this.setState({ embeds: JSON.parse(JSON.stringify(embedsOriginal)), unsaved: false })
  }

  apply = () => {
    if (!this.state.unsaved) return
    const { csrfToken, guildId, feedId } = this.props
    const payload = { ...this.state.embeds[this.state.index] }
    // Convert color to int
    if (payload.color) payload.color = +payload.color
    // Fix the timestamp from the none value
    if (payload.timestamp === 'none') payload.timestamp = ''
    // Take care of fields
    if (payload.fields) {
      if (payload.fields.length === 0) payload.fields = ''
      else {
        const fields = [ ...payload.fields ]
        for (let i = fields.length - 1; i >= 0; --i) {
          const field = fields[i]
          if (!field.title || !field.value) return toast.error(`Each embed field must have the title and value specified!`)
          else if (field.title && field.value && fields[i].inline === false) {
            // Embed fields are false by default, so delete the key
            const field = { ...fields[i] }
            delete field.inline
            fields[i] = field
          }
        }
        payload.fields = fields
      }
    }
    this.setState({ saving: true })
    axios.patch(`/api/guilds/${guildId}/feeds/${feedId}/embeds/${this.state.index}`, payload, { headers: { 'CSRF-Token': csrfToken } }).then(() => {
      toast.success('Saved embed changes, woohoo!')
      this.setState({ saving: false, unsaved: false })
    }).catch(err => {
      if (err.response && err.response.status === 304) {
        this.setState({ saving: false})
        return toast.success('No changes detected')
      } else this.setState({ saving: false })
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to update feed embed<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
      console.log(err.response || err.message)
    })
  }

  render () {
    const onUpdate = this.onUpdate
    const { embedsOriginal, feeds, guildId, feedId } = this.props
    const hasWebhooks = feeds[guildId] && feeds[guildId][feedId] ? !!feeds[guildId][feedId].webhook : false
    const originalValues = embedsOriginal[this.state.index] || {}
    const valuesToUse = {}
    for (const key in embedPropertiesNames) {
      const propertyName = embedPropertiesNames[key]
      valuesToUse[propertyName] = this.state.embeds[this.state.index] && this.state.embeds[this.state.index][propertyName] === '' ? '' : this.state.embeds[this.state.index] ? (this.state.embeds[this.state.index][propertyName] || originalValues[propertyName] || '') : ''
    }


    const unsaved = this.state.unsaved

    const fieldElements = []
    const thisEmbed = this.state.embeds[this.state.index]
    if (thisEmbed && thisEmbed.fields) {
      for (let i = 0; i < thisEmbed.fields.length; ++i) {
        const field = thisEmbed.fields[i]
        fieldElements.push(
          <EmbedFieldBox key={i}>
            <div>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                Field {i + 1}
                <Button basic content='Remove' onClick={e => this.removeEmbedField(i)} />
              </div>
              <Divider />
              <SectionItemTitle style={{display: 'block'}}>Title</SectionItemTitle>
              <Input fluid value={field.title || ''} style={{marginBottom: '1em', marginTop: '1em'}} onChange={e => this.onUpdateField(i, 'title', e.target.value)} />
              <SectionItemTitle style={{display: 'block'}}>Value</SectionItemTitle>
              <TextArea value={field.value || ''} style={{marginTop: '1em'}} onChange={e => this.onUpdateField(i, 'value', e.target.value)} />
              <div style={{ marginTop: '1em' }}>
                <Checkbox label='Inline' checked={field.inline || false} onChange={(e, data) => this.onUpdateField(i, 'inline', data.checked)} />
              </div>
            </div>
          </EmbedFieldBox>
        )
      }
    }

    // Author Section

    return (
      <div>
        <Section
          name='Author'
          inputs={[
            { label: 'Text', variable: embedPropertiesNames.authorName, value: valuesToUse[embedPropertiesNames.authorName] },
            { label: 'Icon URL', variable: embedPropertiesNames.authorIconUrl, value: valuesToUse[embedPropertiesNames.authorIconUrl], condition: !!valuesToUse[embedPropertiesNames.authorName] },
            { label: 'URL', variable: embedPropertiesNames.authorUrl, value: valuesToUse[embedPropertiesNames.authorUrl], condition: !!valuesToUse[embedPropertiesNames.authorName] }
          ]}
          onUpdate={onUpdate}
        />
        <Section
          name='Title'
          inputs={[
            { label: 'Text', variable: embedPropertiesNames.title, value: valuesToUse[embedPropertiesNames.title] },
            { label: 'URL', variable: embedPropertiesNames.url, value: valuesToUse[embedPropertiesNames.url], condition: !!valuesToUse[embedPropertiesNames.title] }
          ]}
          onUpdate={onUpdate}
        />
        <Section
          name='Description'
          inputs={[
            { label: 'Text', variable: embedPropertiesNames.description, textarea: true, value: valuesToUse[embedPropertiesNames.description] },
          ]}
          onUpdate={onUpdate}
        />
        <Section
          name='Images'
          inputs={[
            { label: 'Image URL', variable: embedPropertiesNames.imageUrl, value: valuesToUse[embedPropertiesNames.imageUrl] },
            { label: 'Thumbnail URL', variable: embedPropertiesNames.thumbnailUrl, value: valuesToUse[embedPropertiesNames.thumbnailUrl] }
          ]}
          onUpdate={onUpdate}
        />
        <Section
          name='Footer'
          inputs={[
            { label: 'Text', variable: embedPropertiesNames.footerText, value: valuesToUse[embedPropertiesNames.footerText] },
            { label: 'Icon URL', variable: embedPropertiesNames.footerIconUrl, values: valuesToUse[embedPropertiesNames.footerIconUrl], condition: !!valuesToUse[embedPropertiesNames.footerText] },
            { label: 'Timestamp', variable: embedPropertiesNames.timestamp, dropdown: true, options: [{ text: 'None', value: 'none' }, { text: 'article', value: 'article' }, { text: 'now', value: 'now' }], value: valuesToUse[embedPropertiesNames.timestamp] }
          ]}
          onUpdate={onUpdate}
        />
        <Section
          name='Color'
          inputs={[
            { label: 'Number', variable: embedPropertiesNames.color, color: true, value: valuesToUse[embedPropertiesNames.color] }
          ]}
          onUpdate={onUpdate}
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
                    <AddEmbedFieldBox key={thisEmbed && thisEmbed.fields ? thisEmbed.fields.length : 0} onClick={this.addEmbedField}>
                      <Icon name='add' size='big' />
                    </AddEmbedFieldBox>
                  </div>
                </EmbedFieldsWrapperInner>
              </Scrollbars>
            </EmbedFieldsWrapper>
          }
        />
        <SelectionControls>
          <Button disabled={this.state.index === 0 || unsaved} icon='chevron left' circular onClick={this.prevIndex} />
          <div>
            <h6>{this.state.index === 0 ? '' : this.state.index}</h6>
            <SectionSubtitle>{this.state.index + 1}</SectionSubtitle>
            <h6>{this.state.index >= embedsOriginal.length - 1 ? '' : this.state.index + 2}</h6>
          </div>
          {!hasWebhooks
          ? <Popup
              inverted
              content='Only feeds with webhooks attached may use more embeds'
              trigger={<span><Button disabled icon='add' circular/></span>}
            />
          : <Button disabled={this.state.index >= 8 || this.state.index >= embedsOriginal.length} icon={this.state.index >= embedsOriginal.length - 1 ? 'add' : 'chevron right'} circular onClick={this.nextIndex} />
          }
        </SelectionControls>
        <ActionButtons>
          <PopInButton key='discard-changes-embed' content='Reset' basic inverted onClick={this.discardChanges} pose={this.state.saving ? 'exit' : unsaved ? 'enter' : 'exit'} />
          <Button disabled={this.state.saving || !unsaved} content='Save' color='green' onClick={this.apply} />
        </ActionButtons>
      </div>
    )
  }
}

EmbedSettings.propTypes = {
  embeds: PropTypes.array,
  onUpdate: PropTypes.func
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(EmbedSettings))
