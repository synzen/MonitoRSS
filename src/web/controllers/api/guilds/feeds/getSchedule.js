/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getSchedule (req, res, next) {
  const feed = req.feed
  try {
    const schedule = await feed.determineSchedule()
    res.json(schedule)
  } catch (err) {
    next(err)
  }
}

module.exports = getSchedule
