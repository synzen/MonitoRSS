/*******************************
           Serve Docs
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

var gulpif = require('gulp-if')

var header = require('gulp-header')

var less = require('gulp-less')

var minifyCSS = require('gulp-clean-css')

var plumber = require('gulp-plumber')

var print = require('gulp-print').default

var rename = require('gulp-rename')

var replace = require('gulp-replace')

var uglify = require('gulp-uglify')

var replaceExt = require('replace-ext')

var watch = require('gulp-watch')

// user config

var config = require('../config/docs')

// task config

var tasks = require('../config/tasks')

var configSetup = require('../config/project/config')

var install = require('../config/project/install')

// shorthand

var banner = tasks.banner

var comments = tasks.regExp.comments

var log = tasks.log

var settings = tasks.settings

var globs

var assets

var output

var source

require('../collections/internal')(gulp)

module.exports = function () {
  // use a different config
  config = configSetup.addDerivedValues(config)

  // shorthand
  globs = config.globs
  assets = config.paths.assets
  output = config.paths.output
  source = config.paths.source

  /* --------------
     Copy Source
  --------------- */

  gulp
    .watch([
      'src/**/*.*'
    ], function (file) {
      console.clear()
      return gulp.src(file.path, {
        base: 'src/'
      })
        .pipe(gulp.dest(output.less))
        .pipe(print(log.created))
    })

  /* --------------
    Copy Examples
  --------------- */

  gulp
    .watch([
      'examples/**/*.*'
    ], function (file) {
      console.clear()
      return gulp.src(file.path, {
        base: 'examples/'
      })
        .pipe(gulp.dest(output.examples))
        .pipe(print(log.created))
    })

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
      isConfig = (file.path.indexOf('theme.config') !== -1 || file.path.indexOf('site.variables') !== -1)
      isPackagedTheme = (file.path.indexOf(source.themes) !== -1)
      isSiteTheme = (file.path.indexOf(source.site) !== -1)
      isDefinition = (file.path.indexOf(source.definitions) !== -1)

      if (isConfig) {
        // console.info('Rebuilding all files');
        // cant rebuild paths are wrong
        // gulp.start('build-docs');
        return
      } else if (isPackagedTheme) {
        console.log('Change detected in packaged theme')
        lessPath = replaceExt(file.path, '.less')
        lessPath = lessPath.replace(tasks.regExp.theme, source.definitions)
      } else if (isSiteTheme) {
        console.log('Change detected in site theme')
        lessPath = replaceExt(file.path, '.less')
        lessPath = lessPath.replace(source.site, source.definitions)
      } else {
        console.log('Change detected in definition')
        lessPath = file.path
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
          .pipe(replace(comments.large.in, comments.large.out))
          .pipe(replace(comments.small.in, comments.small.out))
          .pipe(replace(comments.tiny.in, comments.tiny.out))
          .pipe(autoprefixer(settings.prefix))
          .pipe(gulpif(config.hasPermission, chmod(config.permission)))

        // use 2 concurrent streams from same pipe
        uncompressedStream = stream.pipe(clone())
        compressedStream = stream.pipe(clone())

        uncompressedStream
          .pipe(plumber())
          .pipe(replace(assets.source, assets.uncompressed))
          .pipe(header(banner, settings.header))
          .pipe(gulp.dest(output.uncompressed))
          .pipe(print(log.created))
          .on('end', function () {
            gulp.start('package uncompressed docs css')
          })

        compressedStream
          .pipe(plumber())
          .pipe(replace(assets.source, assets.compressed))
          .pipe(minifyCSS(settings.minify))
          .pipe(rename(settings.rename.minCSS))
          .pipe(header(banner, settings.header))
          .pipe(gulp.dest(output.compressed))
          .pipe(print(log.created))
          .on('end', function () {
            gulp.start('package compressed docs css')
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
        .pipe(gulpif(config.hasPermission, chmod(config.permission)))
        .pipe(gulp.dest(output.uncompressed))
        .pipe(print(log.created))
        .pipe(uglify(settings.uglify))
        .pipe(rename(settings.rename.minJS))
        .pipe(gulp.dest(output.compressed))
        .pipe(print(log.created))
        .on('end', function () {
          gulp.start('package compressed docs js')
          gulp.start('package uncompressed docs js')
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
