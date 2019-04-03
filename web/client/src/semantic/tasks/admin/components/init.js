/*******************************
          Init Repos
*******************************/

/*

 This task pulls the latest version of each component from GitHub

  * Creates new repo if doesnt exist (locally & GitHub)
  * Adds remote it doesnt exists
  * Pulls latest changes from repo

*/

var
  gulp = require('gulp')

// node dependencies

var console = require('better-console')

var del = require('del')

var fs = require('fs')

var path = require('path')

var git = require('gulp-git')

var githubAPI = require('github')

var mkdirp = require('mkdirp')

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

    var outputDirectory = path.resolve(release.outputRoot + component)

    var capitalizedComponent = component.charAt(0).toUpperCase() + component.slice(1)

    var repoName = release.componentRepoRoot + capitalizedComponent

    var gitOptions = { cwd: outputDirectory }

    var pullOptions = { args: '-q', cwd: outputDirectory, quiet: true }

    var resetOptions = { args: '-q --hard', cwd: outputDirectory, quiet: true }

    var gitURL = 'git@github.com:' + release.org + '/' + repoName + '.git'

    var repoURL = 'https://github.com/' + release.org + '/' + repoName + '/'

    var localRepoSetup = fs.existsSync(path.join(outputDirectory, '.git'))

    console.log('Processing repository: ' + outputDirectory)

    // create folder if doesn't exist
    if (!fs.existsSync(outputDirectory)) {
      mkdirp.sync(outputDirectory)
    }

    // clean folder
    if (release.outputRoot.search('../repos') == 0) {
      console.info('Cleaning dir', outputDirectory)
      del.sync([outputDirectory + '**/*'], { silent: true, force: true })
    }

    // set-up local repo
    function setupRepo () {
      if (localRepoSetup) {
        addRemote()
      } else {
        initRepo()
      }
    }

    function initRepo () {
      console.info('Initializing repository for ' + component)
      git.init(gitOptions, function (error) {
        if (error) {
          console.error('Error initializing repo', error)
        }
        addRemote()
      })
    }

    function createRepo () {
      console.info('Creating GitHub repo ' + repoURL)
      github.repos.createFromOrg({
        org: release.org,
        name: repoName,
        homepage: release.homepage
      }, function () {
        setupRepo()
      })
    }

    function addRemote () {
      console.info('Adding remote origin as ' + gitURL)
      git.addRemote('origin', gitURL, gitOptions, function () {
        pullFiles()
      })
    }

    function pullFiles () {
      console.info('Pulling ' + component + ' files')
      git.pull('origin', 'master', pullOptions, function (error) {
        resetFiles()
      })
    }

    function resetFiles () {
      console.info('Resetting files to head')
      git.reset('HEAD', resetOptions, function (error) {
        nextRepo()
      })
    }

    function nextRepo () {
      // console.log('Sleeping for 1 second...');
      // avoid rate throttling
      global.clearTimeout(timer)
      timer = global.setTimeout(function () {
        stepRepo()
      }, 0)
    }

    if (localRepoSetup) {
      pullFiles()
    } else {
      setupRepo()
      // createRepo() only use to create remote repo (easier to do manually)
    }
  }

  stepRepo()
}
