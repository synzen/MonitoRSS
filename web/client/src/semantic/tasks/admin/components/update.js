/*******************************
          Update Repos
*******************************/

/*

 This task update all SUI individual component repos with new versions of components

  * Commits changes from create repo
  * Pushes changes to GitHub
  * Tag new releases if version changed in main repo

*/

var
  gulp = require('gulp')

// node dependencies

var console = require('better-console')

var fs = require('fs')

var path = require('path')

var git = require('gulp-git')

var githubAPI = require('github')

var requireDotFile = require('require-dot-file')

// admin files

var github = require('../../config/admin/github.js')

var release = require('../../config/admin/release')

var project = require('../../config/project/release')

// oAuth configuration for GitHub

var oAuth = fs.existsSync(__dirname + '/../../config/admin/oauth.js')
  ? require('../../config/admin/oauth')
  : false

// shorthand

var version = project.version

module.exports = function (callback) {
  var
    index = -1

  var total = release.components.length

  var timer

  var stream

  var stepRepo

  if (!oAuth) {
    console.error('Must add oauth token for GitHub in tasks/config/admin/oauth.js')
    return
  }

  // Do Git commands synchronously per component, to avoid issues
  stepRepo = function () {
    index = index + 1
    if (index >= total) {
      callback()
      return
    }

    var
      component = release.components[index]

    var outputDirectory = path.resolve(path.join(release.outputRoot, component))

    var capitalizedComponent = component.charAt(0).toUpperCase() + component.slice(1)

    var repoName = release.componentRepoRoot + capitalizedComponent

    var gitURL = 'https://github.com/' + release.org + '/' + repoName + '.git'

    var repoURL = 'https://github.com/' + release.org + '/' + repoName + '/'

    var commitArgs = (oAuth.name !== undefined && oAuth.email !== undefined)
      ? '--author "' + oAuth.name + ' <' + oAuth.email + '>"'
      : ''

    var componentPackage = fs.existsSync(outputDirectory + 'package.json')
      ? require(outputDirectory + 'package.json')
      : false

    var isNewVersion = (version && componentPackage.version != version)

    var commitMessage = (isNewVersion)
      ? 'Updated component to version ' + version
      : 'Updated files from main repo'

    var gitOptions = { cwd: outputDirectory }

    var commitOptions = { args: commitArgs, cwd: outputDirectory }

    var releaseOptions = { tag_name: version, owner: release.org, repo: repoName }

    var fileModeOptions = { args: 'config core.fileMode false', cwd: outputDirectory }

    var usernameOptions = { args: 'config user.name "' + oAuth.name + '"', cwd: outputDirectory }

    var emailOptions = { args: 'config user.email "' + oAuth.email + '"', cwd: outputDirectory }

    var versionOptions = { args: 'rev-parse --verify HEAD', cwd: outputDirectory }

    var localRepoSetup = fs.existsSync(path.join(outputDirectory, '.git'))

    var canProceed = true

    console.info('Processing repository:' + outputDirectory)

    function setConfig () {
      git.exec(fileModeOptions, function () {
        git.exec(usernameOptions, function () {
          git.exec(emailOptions, function () {
            commitFiles()
          })
        })
      })
    }

    // standard path
    function commitFiles () {
      // commit files
      console.info('Committing ' + component + ' files', commitArgs)
      gulp.src('./', gitOptions)
        .pipe(git.add(gitOptions))
        .pipe(git.commit(commitMessage, commitOptions))
        .on('error', function (error) {
          // canProceed = false; bug in git commit <https://github.com/stevelacy/gulp-git/issues/49>
        })
        .on('finish', function (callback) {
          if (canProceed) {
            pushFiles()
          } else {
            console.info('Nothing new to commit')
            nextRepo()
          }
        })
    }

    // push changes to remote
    function pushFiles () {
      console.info('Pushing files for ' + component)
      git.push('origin', 'master', { args: '', cwd: outputDirectory }, function (error) {
        console.info('Push completed successfully')
        getSHA()
      })
    }

    // gets SHA of last commit
    function getSHA () {
      git.exec(versionOptions, function (error, version) {
        version = version.trim()
        createRelease(version)
      })
    }

    // create release on GitHub.com
    function createRelease (version) {
      if (version) {
        releaseOptions.target_commitish = version
      }
      github.repos.createRelease(releaseOptions, function () {
        nextRepo()
      })
    }

    // Steps to next repository
    function nextRepo () {
      console.log('Sleeping for 1 second...')
      // avoid rate throttling
      global.clearTimeout(timer)
      timer = global.setTimeout(stepRepo, 100)
    }

    if (localRepoSetup) {
      setConfig()
    } else {
      console.error('Repository must be setup before running update components')
    }
  }

  stepRepo()
}
