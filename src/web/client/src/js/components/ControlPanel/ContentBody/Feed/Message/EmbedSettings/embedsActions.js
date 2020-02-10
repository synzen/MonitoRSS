export const ADD_FIELD = 'ADD_FIELD'
export const REMOVE_FIELD = 'REMOVE_FIELD'
export const SET_FIELD_PROPERTY = 'SET_FIELD_PROPERTY'
export const SET_PROPERTY = 'SET_PROPERTY'
export const SET_EMBEDS = 'SET_EMBEDS'

export function addField (embedIndex) {
  return {
    type: ADD_FIELD,
    payload: {
      embedIndex
    }
  }
}

export function removeField (embedIndex, fieldIndex) {
  return {
    type: REMOVE_FIELD,
    payload: {
      embedIndex,
      fieldIndex
    }
  }
}

export function setFieldProperty (embedIndex, fieldIndex, property, value) {
  return {
    type: SET_FIELD_PROPERTY,
    payload: {
      embedIndex,
      fieldIndex,
      property,
      value
    }
  }
}

export function setProperty (embedIndex, property, value) {
  return {
    type: SET_PROPERTY,
    payload: {
      embedIndex,
      property,
      value
    }
  }
}

export function setEmbeds (embeds) {
  return {
    type: SET_EMBEDS,
    payload: embeds
  }
}
