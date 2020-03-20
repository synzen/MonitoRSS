/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function getGuild (req, res) {
  if (req.guildData) {
    res.json(req.guildData.profile)
  } else {
    res.json({})
  }
}

module.exports = getGuild
