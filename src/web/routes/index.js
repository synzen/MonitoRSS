const express = require('express')
const router = express.Router()
const path = require('path')

router.use('/api', require('./api/index.js'))
router.get('/login', require('../controllers/login.js'))
router.get('/logout', require('../controllers/logout.js'))
router.get('/authorize', require('../controllers/authorize.js'))
router.get(['/cp', '/cp/*'], require('../controllers/cp.js'))
// Override the response from express.static by injecting meta title and description
router.get('/', require('../controllers/root.js'))
// Provide a custom meta title and description for FAQ
router.get('/faq/*', require('../controllers/faq.js'))
router.use(express.static(path.join(__dirname, '..', 'client/build')))
// Redirect all other routes not handled
router.get('*', require('../controllers/all.js'))

module.exports = router
