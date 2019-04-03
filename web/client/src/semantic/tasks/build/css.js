/*******************************
          Build Task
*******************************/

var
  gulp = require('gulp')

// node dependencies

var console = require('better-console')

var fs = require('fs')

// gulp dependencies

var autoprefixer = require('gulp-autoprefixer')

var chmod = require('gulp-chmod')

var clone = require('gulp-clone')

var flatten = require('gulp-flatten')

var gulpif = require('gulp-if')

var less = require('gulp-less')

var minifyCSS = require('gulp-clean-css')

var plumber = require('gulp-plumber')

var print = require('gulp-print').default

var rename = require('gulp-rename')

var replace = require('gulp-replace')

var runSequence = require('run-sequence')

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
    tasksCompleted = 0

  var maybeCallback = function () {
    tasksCompleted++
    if (tasksCompleted === 2) {
      callback()
    }
  }

  var stream

  var compressedStream

  var uncompressedStream

  console.info('Building CSS')

  if (!install.isSetup()) {
    console.error('Cannot build files. Run "gulp install" to set-up Semantic')
    return
  }

  // unified css stream
  stream = gulp.src(source.definitions + '/**/' + globs.components + '.less')
    .pipe(plumber(settings.plumber.less))
    .pipe(less(settings.less))
    .pipe(autoprefixer(settings.prefix))
    .pipe(replace(comments.variables.in, comments.variables.out))
    .pipe(replace(comments.license.in, comments.license.out))
    .pipe(replace(comments.large.in, comments.large.out))
    .pipe(replace(comments.small.in, comments.small.out))
    .pipe(replace(comments.tiny.in, comments.tiny.out))
    .pipe(flatten())

  // two concurrent streams from same source to concat release
  uncompressedStream = stream.pipe(clone())
  compressedStream = stream.pipe(clone())

  // uncompressed component css
  uncompressedStream
    .pipe(plumber())
    .pipe(replace(assets.source, assets.uncompressed))
    .pipe(gulpif(config.hasPermission, chmod(config.permission)))
    .pipe(gulp.dest(output.uncompressed))
    .pipe(print(log.created))
    .on('end', function () {
      runSequence('package uncompressed css', maybeCallback)
    })

  // compressed component css
  compressedStream
    .pipe(plumber())
    .pipe(clone())
    .pipe(replace(assets.source, assets.compressed))
    .pipe(minifyCSS(settings.minify))
    .pipe(rename(settings.rename.minCSS))
    .pipe(gulpif(config.hasPermission, chmod(config.permission)))
    .pipe(gulp.dest(output.compressed))
    .pipe(print(log.created))
    .on('end', function () {
      runSequence('package compressed css', maybeCallback)
    })
}
