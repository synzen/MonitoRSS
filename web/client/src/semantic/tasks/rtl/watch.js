/*******************************
           Watch Task
*******************************/

var
  gulp = require('gulp')

// node deps

var console = require('better-console')

var fs = require('fs')

// gulp deps

var autoprefixer = require('gulp-autoprefixer')

var chmod = require('gulp-chmod')

var clone = require('gulp-clone')

var gulpif = require('gulp-if')

var less = require('gulp-less')

var minifyCSS = require('gulp-clean-css')

var plumber = require('gulp-plumber')

var print = require('gulp-print').default

var rename = require('gulp-rename')

var replace = require('gulp-replace')

var rtlcss = require('gulp-rtlcss')

var uglify = require('gulp-uglify')

var replaceExt = require('replace-ext')

var watch = require('gulp-watch')

// user config

var config = require('../config/user')

// task config

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
  if (!install.isSetup()) {
    console.error('Cannot watch files. Run "gulp install" to set-up Semantic')
    return
  }

  console.clear()
  console.log('Watching source files for changes')

  /* --------------
      Watch CSS
  --------------- */

  gulp
    .watch([
      source.config,
      source.definitions + '/**/*.less',
      source.site + '/**/*.{overrides,variables}',
      source.themes + '/**/*.{overrides,variables}'
    ], function (file) {
      var
        lessPath,

        stream,
        compressedStream,
        uncompressedStream,

        isDefinition,
        isPackagedTheme,
        isSiteTheme,
        isConfig

      // log modified file
      gulp.src(file.path)
        .pipe(print(log.modified))

      /* --------------
         Find Source
      --------------- */

      // recompile on *.override , *.variable change
      isConfig = (file.path.indexOf('.config') !== -1)
      isPackagedTheme = (file.path.indexOf(source.themes) !== -1)
      isSiteTheme = (file.path.indexOf(source.site) !== -1)
      isDefinition = (file.path.indexOf(source.definitions) !== -1)

      if (isConfig) {
        console.log('Change detected in theme config')
        // cant tell which theme was changed in theme.config, rebuild all
        gulp.start('build')
      } else if (isPackagedTheme) {
        console.log('Change detected in packaged theme')
        lessPath = lessPath.replace(tasks.regExp.theme, source.definitions)
        lessPath = replaceExt(file.path, '.less')
      } else if (isSiteTheme) {
        console.log('Change detected in site theme')
        lessPath = lessPath.replace(source.site, source.definitions)
        lessPath = replaceExt(file.path, '.less')
      } else if (isDefinition) {
        console.log('Change detected in definition')
        lessPath = replaceExt(file.path, '.less')
      }

      /* --------------
         Create CSS
      --------------- */

      if (fs.existsSync(lessPath)) {
        // unified css stream
        stream = gulp.src(lessPath)
          .pipe(plumber())
          .pipe(less(settings.less))
          .pipe(replace(comments.variables.in, comments.variables.out))
          .pipe(replace(comments.license.in, comments.license.out))
          .pipe(replace(comments.large.in, comments.large.out))
          .pipe(replace(comments.small.in, comments.small.out))
          .pipe(replace(comments.tiny.in, comments.tiny.out))
          .pipe(autoprefixer(settings.prefix))
          .pipe(gulpif(config.hasPermission, chmod(config.permission)))
          .pipe(rtlcss())

        // use 2 concurrent streams from same pipe
        uncompressedStream = stream.pipe(clone())
        compressedStream = stream.pipe(clone())

        uncompressedStream
          .pipe(plumber())
          .pipe(replace(assets.source, assets.uncompressed))
          .pipe(rename(settings.rename.rtlCSS))
          .pipe(gulp.dest(output.uncompressed))
          .pipe(print(log.created))
          .on('end', function () {
            gulp.start('package uncompressed rtl css')
          })

        compressedStream
          .pipe(plumber())
          .pipe(replace(assets.source, assets.compressed))
          .pipe(minifyCSS(settings.minify))
          .pipe(rename(settings.rename.minCSS))
          .pipe(rename(settings.rename.rtlMinCSS))
          .pipe(gulp.dest(output.compressed))
          .pipe(print(log.created))
          .on('end', function () {
            gulp.start('package compressed rtl css')
          })
      } else {
        console.log('Cannot find UI definition at path', lessPath)
      }
    })

  /* --------------
      Watch JS
  --------------- */

  gulp
    .watch([
      source.definitions + '/**/*.js'
    ], function (file) {
      gulp.src(file.path)
        .pipe(plumber())
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
    })

  /* --------------
    Watch Assets
  --------------- */

  // only copy assets that match component names (or their plural)
  gulp
    .watch([
      source.themes + '/**/assets/**/' + globs.components + '?(s).*'
    ], function (file) {
      // copy assets
      gulp.src(file.path, { base: source.themes })
        .pipe(gulpif(config.hasPermission, chmod(config.permission)))
        .pipe(gulp.dest(output.themes))
        .pipe(print(log.created))
    })
}
