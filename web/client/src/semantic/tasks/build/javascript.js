/*******************************
          Build Task
*******************************/

var
  gulp = require('gulp')

// node dependencies

var console = require('better-console')

var fs = require('fs')

// gulp dependencies

var chmod = require('gulp-chmod')

var flatten = require('gulp-flatten')

var gulpif = require('gulp-if')

var plumber = require('gulp-plumber')

var print = require('gulp-print').default

var rename = require('gulp-rename')

var replace = require('gulp-replace')

var uglify = require('gulp-uglify')

// config

var config = require('../config/user')

var tasks = require('../config/tasks')

var install = require('../config/project/install')

// shorthand

var globs = config.globs

var assets = config.paths.assets

var output = config.paths.output

var source = config.paths.source

var banner = tasks.banner

var comments = tasks.regExp.comments

var log = tasks.log

var settings = tasks.settings

// add internal tasks (concat release)
require('../collections/internal')(gulp)

module.exports = function (callback) {
  var
    stream,
    compressedStream,
    uncompressedStream

  console.info('Building Javascript')

  if (!install.isSetup()) {
    console.error('Cannot build files. Run "gulp install" to set-up Semantic')
    return
  }

  // copy source javascript
  gulp.src(source.definitions + '/**/' + globs.components + '.js')
    .pipe(plumber())
    .pipe(flatten())
    .pipe(replace(comments.license.in, comments.license.out))
    .pipe(gulp.dest(output.uncompressed))
    .pipe(gulpif(config.hasPermission, chmod(config.permission)))
    .pipe(print(log.created))
    .pipe(uglify(settings.uglify))
    .pipe(rename(settings.rename.minJS))
    .pipe(gulp.dest(output.compressed))
    .pipe(gulpif(config.hasPermission, chmod(config.permission)))
    .pipe(print(log.created))
    .on('end', function () {
      gulp.start('package compressed js')
      gulp.start('package uncompressed js')
      callback()
    })
}
