/*******************************
    Internal Task Collection
*******************************/

/* These tasks create packaged files from **dist** components
   Not intended to be called directly by a user because
   these do not build fresh from **src**
*/

module.exports = function (gulp) {
  var
    // node dependencies
    fs = require('fs')

  var chmod = require('gulp-chmod')

  var concat = require('gulp-concat')

  var concatCSS = require('gulp-concat-css')

  var clone = require('gulp-clone')

  var dedupe = require('gulp-dedupe')

  var gulpif = require('gulp-if')

  var header = require('gulp-header')

  var less = require('gulp-less')

  var minifyCSS = require('gulp-clean-css')

  var plumber = require('gulp-plumber')

  var print = require('gulp-print').default

  var rename = require('gulp-rename')

  var replace = require('gulp-replace')

  var uglify = require('gulp-uglify')

  // user config

  var config = require('./../config/user')

  var docsConfig = require('./../config/docs')

  // install config

  var tasks = require('./../config/tasks')

  var release = require('./../config/project/release')

  // shorthand

  var globs = config.globs

  var assets = config.paths.assets

  var output = config.paths.output

  var banner = tasks.banner

  var filenames = tasks.filenames

  var log = tasks.log

  var settings = tasks.settings

  /* --------------
      Packaged
  --------------- */

  gulp.task('package uncompressed css', function () {
    return gulp.src(output.uncompressed + '/**/' + globs.components + globs.ignored + '.css')
      .pipe(plumber())
      .pipe(dedupe())
      .pipe(replace(assets.uncompressed, assets.packaged))
      .pipe(concatCSS(filenames.concatenatedCSS, settings.concatCSS))
      .pipe(gulpif(config.hasPermission, chmod(config.permission)))
      .pipe(header(banner, settings.header))
      .pipe(gulp.dest(output.packaged))
      .pipe(print(log.created))
  })

  gulp.task('package compressed css', function () {
    return gulp.src(output.uncompressed + '/**/' + globs.components + globs.ignored + '.css')
      .pipe(plumber())
      .pipe(dedupe())
      .pipe(replace(assets.uncompressed, assets.packaged))
      .pipe(concatCSS(filenames.concatenatedMinifiedCSS, settings.concatCSS))
      .pipe(gulpif(config.hasPermission, chmod(config.permission)))
      .pipe(minifyCSS(settings.concatMinify))
      .pipe(header(banner, settings.header))
      .pipe(gulp.dest(output.packaged))
      .pipe(print(log.created))
  })

  gulp.task('package uncompressed js', function () {
    return gulp.src(output.uncompressed + '/**/' + globs.components + globs.ignored + '.js')
      .pipe(plumber())
      .pipe(dedupe())
      .pipe(replace(assets.uncompressed, assets.packaged))
      .pipe(concat(filenames.concatenatedJS))
      .pipe(header(banner, settings.header))
      .pipe(gulpif(config.hasPermission, chmod(config.permission)))
      .pipe(gulp.dest(output.packaged))
      .pipe(print(log.created))
  })

  gulp.task('package compressed js', function () {
    return gulp.src(output.uncompressed + '/**/' + globs.components + globs.ignored + '.js')
      .pipe(plumber())
      .pipe(dedupe())
      .pipe(replace(assets.uncompressed, assets.packaged))
      .pipe(concat(filenames.concatenatedMinifiedJS))
      .pipe(uglify(settings.concatUglify))
      .pipe(header(banner, settings.header))
      .pipe(gulpif(config.hasPermission, chmod(config.permission)))
      .pipe(gulp.dest(output.packaged))
      .pipe(print(log.created))
  })

  /* --------------
        RTL
  --------------- */

  if (config.rtl) {
    gulp.task('package uncompressed rtl css', function () {
      return gulp.src(output.uncompressed + '/**/' + globs.components + globs.ignoredRTL + '.rtl.css')
        .pipe(dedupe())
        .pipe(replace(assets.uncompressed, assets.packaged))
        .pipe(concatCSS(filenames.concatenatedRTLCSS, settings.concatCSS))
        .pipe(gulpif(config.hasPermission, chmod(config.permission)))
        .pipe(header(banner, settings.header))
        .pipe(gulp.dest(output.packaged))
        .pipe(print(log.created))
    })

    gulp.task('package compressed rtl css', function () {
      return gulp.src(output.uncompressed + '/**/' + globs.components + globs.ignoredRTL + '.rtl.css')
        .pipe(dedupe())
        .pipe(replace(assets.uncompressed, assets.packaged))
        .pipe(concatCSS(filenames.concatenatedMinifiedRTLCSS, settings.concatCSS))
        .pipe(gulpif(config.hasPermission, chmod(config.permission)))
        .pipe(minifyCSS(settings.concatMinify))
        .pipe(header(banner, settings.header))
        .pipe(gulp.dest(output.packaged))
        .pipe(print(log.created))
    })

    gulp.task('package uncompressed docs css', function () {
      return gulp.src(output.uncompressed + '/**/' + globs.components + globs.ignored + '.css')
        .pipe(dedupe())
        .pipe(plumber())
        .pipe(replace(assets.uncompressed, assets.packaged))
        .pipe(concatCSS(filenames.concatenatedCSS, settings.concatCSS))
        .pipe(gulpif(config.hasPermission, chmod(config.permission)))
        .pipe(gulp.dest(output.packaged))
        .pipe(print(log.created))
    })

    gulp.task('package compressed docs css', function () {
      return gulp.src(output.uncompressed + '/**/' + globs.components + globs.ignored + '.css')
        .pipe(dedupe())
        .pipe(plumber())
        .pipe(replace(assets.uncompressed, assets.packaged))
        .pipe(concatCSS(filenames.concatenatedMinifiedCSS, settings.concatCSS))
        .pipe(minifyCSS(settings.concatMinify))
        .pipe(header(banner, settings.header))
        .pipe(gulpif(config.hasPermission, chmod(config.permission)))
        .pipe(gulp.dest(output.packaged))
        .pipe(print(log.created))
    })
  }

  /* --------------
        Docs
  --------------- */

  var
    docsOutput = docsConfig.paths.output

  gulp.task('package uncompressed docs css', function () {
    return gulp.src(docsOutput.uncompressed + '/**/' + globs.components + globs.ignored + '.css')
      .pipe(dedupe())
      .pipe(plumber())
      .pipe(replace(assets.uncompressed, assets.packaged))
      .pipe(concatCSS(filenames.concatenatedCSS, settings.concatCSS))
      .pipe(gulpif(config.hasPermission, chmod(config.permission)))
      .pipe(gulp.dest(docsOutput.packaged))
      .pipe(print(log.created))
  })

  gulp.task('package compressed docs css', function () {
    return gulp.src(docsOutput.uncompressed + '/**/' + globs.components + globs.ignored + '.css')
      .pipe(dedupe())
      .pipe(plumber())
      .pipe(replace(assets.uncompressed, assets.packaged))
      .pipe(concatCSS(filenames.concatenatedMinifiedCSS, settings.concatCSS))
      .pipe(minifyCSS(settings.concatMinify))
      .pipe(header(banner, settings.header))
      .pipe(gulpif(config.hasPermission, chmod(config.permission)))
      .pipe(gulp.dest(docsOutput.packaged))
      .pipe(print(log.created))
  })

  gulp.task('package uncompressed docs js', function () {
    return gulp.src(docsOutput.uncompressed + '/**/' + globs.components + globs.ignored + '.js')
      .pipe(dedupe())
      .pipe(plumber())
      .pipe(replace(assets.uncompressed, assets.packaged))
      .pipe(concat(filenames.concatenatedJS))
      .pipe(header(banner, settings.header))
      .pipe(gulpif(config.hasPermission, chmod(config.permission)))
      .pipe(gulp.dest(docsOutput.packaged))
      .pipe(print(log.created))
  })

  gulp.task('package compressed docs js', function () {
    return gulp.src(docsOutput.uncompressed + '/**/' + globs.components + globs.ignored + '.js')
      .pipe(dedupe())
      .pipe(plumber())
      .pipe(replace(assets.uncompressed, assets.packaged))
      .pipe(concat(filenames.concatenatedMinifiedJS))
      .pipe(uglify(settings.concatUglify))
      .pipe(header(banner, settings.header))
      .pipe(gulpif(config.hasPermission, chmod(config.permission)))
      .pipe(gulp.dest(docsOutput.packaged))
      .pipe(print(log.created))
  })
}
