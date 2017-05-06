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

exports.currentGuilds = currentGuilds // Object for holding all guild profiles

exports.changedGuilds = changedGuilds // Hold any changed guild data here sent from child process

exports.cookieAccessors = cookieAccessors // If restrictCookies is true in config, this is the list of permitted user IDs

exports.overriddenGuilds = overriddenGuilds

exports.feedTracker = feedTracker // Used to track schedule assignment to feeds

exports.allScheduleWords = allScheduleWords // Holds all words across all schedules
