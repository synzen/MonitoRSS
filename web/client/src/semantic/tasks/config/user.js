/*******************************
             Set-up
*******************************/

var
  // npm dependencies
  extend = require('extend')

var fs = require('fs')

var path = require('path')

var requireDotFile = require('require-dot-file')

// semantic.json defaults

var defaults = require('./defaults')

var config = require('./project/config')

// Final config object

var gulpConfig = {}

// semantic.json settings

var userConfig

/*******************************
          User Config
*******************************/

try {
  // looks for config file across all parent directories
  userConfig = requireDotFile('semantic.json')
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('No semantic.json config found')
  }
}

// extend user config with defaults
gulpConfig = (!userConfig)
  ? extend(true, {}, defaults)
  : extend(false, {}, defaults, userConfig)

/*******************************
       Add Derived Values
*******************************/

// adds calculated values
config.addDerivedValues(gulpConfig)

/*******************************
             Export
*******************************/

module.exports = gulpConfig
