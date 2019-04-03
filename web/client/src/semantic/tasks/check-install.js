/*******************************
         Check Install
*******************************/

var
  // node dependencies
  gulp = require('gulp')

var fs = require('fs')

var console = require('better-console')

var install = require('./config/project/install')

// export task
module.exports = function () {
  setTimeout(function () {
    if (!install.isSetup()) {
      console.log('Starting install...')
      gulp.start('install')
    } else {
      gulp.start('watch')
    }
  }, 50) // Delay to allow console.clear to remove messages from check event
}
