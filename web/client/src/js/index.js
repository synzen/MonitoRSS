// Purely for testing redux

import store from './store/index-store.js'
import { testAction } from './actions/index-actions.js'

window.store = store
window.testAction = testAction
