const express = require('express')
const router = express.Router()
const path = require('path')
const controllers = require('../controllers/index.js')

router.use('/api', require('./api/index.js'))
router.get('/login', controllers.login)
router.get('/logout', controllers.logout)
router.get('/authorize', controllers.authorize)
router.get(['/cp', '/cp/*'], controllers.cp)
// Override the response from express.static by injecting meta title and description
router.get('/', controllers.root)
// Provide a custom meta title and description for FAQ
router.get('/faq/*', controllers.faq)
router.use(express.static(path.join(__dirname, '..', 'client/build')))
// Redirect all other routes not handled
router.get('*', controllers.all)

module.exports = router
