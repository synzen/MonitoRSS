/*******************************
          Build Task
*******************************/

var
  gulp = require('gulp')

// node dependencies

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

var rtlcss = require('gulp-rtlcss')

var uglify = require('gulp-uglify')

// user config

var config = require('../config/user')

// install config

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

  console.info('Building Semantic')

  if (!install.isSetup()) {
    console.error('Cannot build files. Run "gulp install" to set-up Semantic')
    return
  }

  // unified css stream
  stream = gulp.src(source.definitions + '/**/' + globs.components + '.less')
    .pipe(plumber())
    .pipe(less(settings.less))
    .pipe(autoprefixer(settings.prefix))
    .pipe(rtlcss())
    .pipe(replace(comments.variables.in, comments.variables.out))
    .pipe(replace(comments.license.in, comments.license.out))
    .pipe(replace(comments.large.in, comments.large.out))
    .pipe(replace(comments.small.in, comments.small.out))
    .pipe(replace(comments.tiny.in, comments.tiny.out))
    .pipe(flatten())

  // two concurrent streams from same source to concat release
  uncompressedStream = stream.pipe(clone())
  compressedStream = stream.pipe(clone())

  uncompressedStream
    .pipe(plumber())
    .pipe(replace(assets.source, assets.uncompressed))
    .pipe(rename(settings.rename.rtlCSS))
    .pipe(gulpif(config.hasPermission, chmod(config.permission)))
    .pipe(gulp.dest(output.uncompressed))
    .pipe(print(log.created))
    .on('end', function () {
      gulp.start('package uncompressed rtl css')
    })

  compressedStream
    .pipe(plumber())
    .pipe(clone())
    .pipe(replace(assets.source, assets.compressed))
    .pipe(minifyCSS(settings.minify))
    .pipe(rename(settings.rename.rtlMinCSS))
    .pipe(gulpif(config.hasPermission, chmod(config.permission)))
    .pipe(gulp.dest(output.compressed))
    .pipe(print(log.created))
    .on('end', function () {
      callback()
      gulp.start('package compressed rtl css')
    })

  // copy assets
  gulp.src(source.themes + '/**/assets/**/' + globs.components + '?(s).*')
    .pipe(gulpif(config.hasPermission, chmod(config.permission)))
    .pipe(gulp.dest(output.themes))

  // copy source javascript
  gulp.src(source.definitions + '/**/' + globs.components + '.js')
    .pipe(plumber())
    .pipe(flatten())
    .pipe(replace(comments.license.in, comments.license.out))
    .pipe(gulpif(config.hasPermission, chmod(config.permission)))
    .pipe(gulp.dest(output.uncompressed))
    .pipe(print(log.created))
    .pipe(uglify(settings.uglify))
    .pipe(rename(settings.rename.minJS))
    .pipe(gulp.dest(output.compressed))
    .pipe(print(log.created))
    .on('end', function () {
      gulp.start('package compressed js')
      gulp.start('package uncompressed js')
    })
}
