import { SET_PROPERTY, SET_FIELD_PROPERTY, ADD_FIELD, REMOVE_FIELD, SET_EMBEDS } from "./embedsActions";
import embedProperties from 'js/constants/embed'

const EMBED_FIELD_LIMITS = {
  name: 256,
  value: 1024
}

const EMBED_PROPERTY_LENGTHS = {
  [embedProperties.title]: 256,
  [embedProperties.description]: 2048,
  [embedProperties.footerText]: 2048,
  [embedProperties.authorName]: 256,
}

export default function reducer (embeds, action) {
  let newState = [ ...embeds ]
  if (action.type === SET_EMBEDS) {
    return action.payload
  } else if (action.type === SET_PROPERTY) {
    // SET PROPERTY
    const { embedIndex, property, value } = action.payload
    if (!EMBED_PROPERTY_LENGTHS[property] || (EMBED_PROPERTY_LENGTHS[property] && value.length < EMBED_PROPERTY_LENGTHS[property])) {
      let currentEmbed = newState[embedIndex] ? { ...newState[embedIndex] } : null
      if (!currentEmbed) {
        newState.push({ [property]: value })
      } else {
        currentEmbed[property] = value
        newState[embedIndex] = currentEmbed
      }
      if (property === 'timestamp' && value === 'none') {
        newState[embedIndex].timestamp = ''
      } else if (property === 'color') {
        newState[embedIndex].color = +value
      }
    }
  } else if (action.type === ADD_FIELD) {
    // ADD FIELD
    const { embedIndex } = action.payload
    let currentEmbed = newState[embedIndex] ? { ...newState[embedIndex] } : null
    if (!currentEmbed) {
      newState.push({ fields: [{}] })
    } else if (!currentEmbed.fields || currentEmbed.fields.length < 25) {
      if (!currentEmbed.fields) {
        currentEmbed.fields = []
      }
      currentEmbed.fields = [...currentEmbed.fields, {}]
      newState[embedIndex] = currentEmbed
    }
  } else if (action.type === REMOVE_FIELD) {
    // REMOVE FIELD
    const { embedIndex, fieldIndex } = action.payload
    let currentEmbed = { ...newState[embedIndex] }
    currentEmbed.fields = [ ...currentEmbed.fields ]
    currentEmbed.fields.splice(fieldIndex, 1)
    if (currentEmbed.fields.length === 0) {
      delete currentEmbed.fields
    }
    newState[embedIndex] = currentEmbed
  } else if (action.type === SET_FIELD_PROPERTY) {
    // SET FIELD PROPERTY
    const { embedIndex, fieldIndex, property, value } = action.payload
    if (!EMBED_FIELD_LIMITS[property] || (EMBED_FIELD_LIMITS[property] && value.length < EMBED_FIELD_LIMITS[property])) {
      let currentEmbed = { ...newState[embedIndex] }
      currentEmbed.fields = [ ...currentEmbed.fields ]
      currentEmbed.fields[fieldIndex] = {
        ...currentEmbed.fields[fieldIndex],
        [property]: value
      }
      newState[embedIndex] = currentEmbed
    }
  }
  return newState
}
