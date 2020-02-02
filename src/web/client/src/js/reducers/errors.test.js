import { CLEAR_ALL_ERRORS } from '../actions/errors'
import errorReducer from './errors';

describe('Error Reducer', () => {
	it('should return default state', () => {
		const newState = errorReducer({}, {});
		expect(newState).toEqual({})
	})
	it('returns original state if not error payload', () => {
		const state = { foo: 1 }
		const stateCopy = { ...state }
		expect(errorReducer(state, { type: 'HERP DERP' })).toEqual(state)
		expect(errorReducer(state, {})).toEqual(stateCopy)
	})
	it('sets the error in the right place', () => {
		const initialState = { jingle: 'bells' }
		const initialStateCopy = { ...initialState }
		const payload = { foo: 'gosh darnit bobby' }
		const action = { type: 'a_FAILURE', payload }
		const returned = errorReducer(initialState, action)
		expect(returned).toEqual({ ...initialState, [action.type]: action.payload })
		// Assert that the reducer did not illegally mutate state
		expect(initialState).toEqual(initialStateCopy)
	})
	it('removes the error from state if finished action', () => {
		const action = { type: 'randomaction_SUCCESS', payload: 1 }
		const initialState = { jingle: 'bells', randomaction_FAILURE: 1 }
		const initialStateCopy = { ...initialState }
		const returned = errorReducer(initialState, action)
		expect(returned).toEqual({ jingle: 'bells' })
		expect(initialState).toEqual(initialStateCopy)
	})
	it('clears all errors properly', () => {
		const initialState = { jingle: 'balls', gertner: 'is op' }
		const action = { type: CLEAR_ALL_ERRORS }
		const initialStateCopy = { ...initialState }
		const returned = errorReducer(initialState, action)
		expect(returned).toEqual({})
		expect(initialState).toEqual(initialStateCopy)
	})
});
