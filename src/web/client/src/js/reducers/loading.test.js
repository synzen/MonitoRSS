import loadingReducer from './loading'

const PREFIX = 'eswtr'
const BEGIN_ACTION = `${PREFIX}_BEGIN`
const FAILURE_ACTION = `${PREFIX}_FAILURE`
const SUCCESS_ACTION = `${PREFIX}_SUCCESS`


describe('loadingReducer', function () {
  it('sets loading on _BEGIN action', function () {
    const action = {
      type: BEGIN_ACTION
    }
    const initialState = {}
    const returned = loadingReducer({...initialState}, action)
    expect(returned).toEqual({
      [BEGIN_ACTION]: true
    })
  })
  it('unsets loading on _SUCCESS action', function () {
    const action = {
      type: SUCCESS_ACTION
    }
    const initialState = {
      [BEGIN_ACTION]: true
    }
    const returned = loadingReducer({...initialState}, action)
    expect(returned).toEqual({})
  })
  it('unsets loading on _FAILURE action', function () {
    const action = {
      type: FAILURE_ACTION
    }
    const initialState = {
      [BEGIN_ACTION]: true
    }
    const returned = loadingReducer({...initialState}, action)
    expect(returned).toEqual({})
  })
  it('does nothing on irrelevant action', function () {
    const action = {
      type: BEGIN_ACTION + '2W46Y3R5E7TDURF'
    }
    const initialState = {
      [BEGIN_ACTION]: true
    }
    const returned = loadingReducer({...initialState}, action)
    expect(returned).toEqual(initialState)
  })
})
