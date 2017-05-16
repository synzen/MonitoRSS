/*
    Used to store data for various aperations across multiple files
*/
const fs = require('fs')
const config = require('../config.json')
const currentGuilds = new Map()
const changedGuilds = []
const feedTracker = {}
const allScheduleWords = []
var cookieAccessors
var overriddenGuilds
var blacklistGuilds
var failedFeeds

try {
  cookieAccessors = JSON.parse(fs.readFileSync('./cookieAccessors.json'))
}
catch(e) {
  cookieAccessors = {ids: []}
}

try {
  overriddenGuilds = JSON.parse(fs.readFileSync('./limitOverrides.json'))
}
catch(e) {
  overriddenGuilds = {}
}

try {
  blacklistGuilds = JSON.parse(fs.readFileSync('./blacklist.json'))
}
catch(e) {
  blacklistGuilds = {ids: []}
}

try {
  failedFeeds = JSON.parse(fs.readFileSync('./util/failedFeeds.json'))
}
catch(e) {
  failedFeeds = {}
}

exports.blacklistGuilds = blacklistGuilds

exports.currentGuilds = currentGuilds // Object for holding all guild profiles

exports.changedGuilds = changedGuilds // Hold any changed guild data here sent from child process

exports.cookieAccessors = cookieAccessors // If restrictCookies is true in config, this is the list of permitted user IDs

exports.overriddenGuilds = overriddenGuilds

exports.feedTracker = feedTracker // Used to track schedule assignment to feeds

exports.allScheduleWords = allScheduleWords // Holds all words across all schedules

exports.failedFeeds = failedFeeds
