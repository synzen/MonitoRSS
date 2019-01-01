import { TEST_ACTION } from '../constants/action-types.js'

export function testAction (payload) {
  return { type: TEST_ACTION, payload }
}
