/*******************************
          Clean Task
*******************************/

var
  del = require('del')

var config = require('./config/user')

var tasks = require('./config/tasks')

// cleans distribution files
module.exports = function (callback) {
  return del([config.paths.clean], tasks.settings.del, callback)
}
