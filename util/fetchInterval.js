/*
    Used to control feed retrieval cycle on disconnects, file updates and store guild profiles
*/

const config = require('../config.json')
const refreshTime = (config.feedSettings.refreshTimeMinutes) ? config.feedSettings.refreshTimeMinutes : 15
const currentGuilds = new Map()
const changedGuilds = new Map()
let fetchInterval

exports.currentGuilds = currentGuilds // Object for holding all guild profiles

exports.changedGuilds = changedGuilds // Hold any changed guild data here sent from child process

exports.deletedGuilds = []

exports.startSchedule = function (command) {
  fetchInterval = setInterval(command, refreshTime*60000)
}

exports.stopSchedule = function () {
  clearInterval(fetchInterval)
}
