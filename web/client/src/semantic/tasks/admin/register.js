/*******************************
          Register PM
*******************************/

/*
  Task to register component repos with Package Managers
  * Registers component with bower
  * Registers component with NPM
*/

var
  // node dependencies
  process = require('child_process')

// config

var release = require('../config/admin/release')

// register components and distributions

var repos = release.distributions.concat(release.components)

var total = repos.length

var index = -1

var stream

var stepRepo

module.exports = function (callback) {
  console.log('Registering repos with package managers')

  // Do Git commands synchronously per component, to avoid issues
  stepRepo = function () {
    index = index + 1
    if (index >= total) {
      callback()
      return
    }
    var
      repo = repos[index].toLowerCase()

    var outputDirectory = release.outputRoot + repo + '/'

    var exec = process.exec

    var execSettings = { cwd: outputDirectory }

    var updateNPM = 'npm publish;meteor publish;'

    /* Register with NPM */
    exec(updateNPM, execSettings, function (err, stdout, stderr) {
      console.log(err, stdout, stderr)
      stepRepo()
    })
  }
  stepRepo()
}
