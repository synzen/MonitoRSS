const feedbackServices = require('../../services/feedback.js')

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createFeedback (req, res, next) {
  const userID = req.session.identity.id
  const username = req.session.identity.username
  const content = req.body.content
  try {
    const created = await feedbackServices.createFeedback(userID, username, content)
    res.json(created)
  } catch (err) {
    next(err)
  }
}

module.exports = createFeedback
