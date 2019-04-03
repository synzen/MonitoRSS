/*******************************
          Build Task
*******************************/

var
  gulp = require('gulp')

// gulp dependencies

var chmod = require('gulp-chmod')

var gulpif = require('gulp-if')

// config

var config = require('../config/user')

var tasks = require('../config/tasks')

// shorthand

var globs = config.globs

var assets = config.paths.assets

var output = config.paths.output

var source = config.paths.source

var log = tasks.log

module.exports = function (callback) {
  console.info('Building assets')

  // copy assets
  return gulp.src(source.themes + '/**/assets/**/*.*')
    .pipe(gulpif(config.hasPermission, chmod(config.permission)))
    .pipe(gulp.dest(output.themes))
}
