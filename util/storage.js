/*
    Used to store data for various aperations across multiple files
*/

const config = require('../config.json')
const overriddenGuilds = new Map()
const currentGuilds = new Map()
const changedGuilds = new Map()
const deletedGuilds = []
const cookieAccessors = require('./cookieAccessors.json')
const feedTracker = {}
const allScheduleWords = []

exports.currentGuilds = currentGuilds // Object for holding all guild profiles

exports.changedGuilds = changedGuilds // Hold any changed guild data here sent from child process

exports.deletedGuilds = deletedGuilds

exports.overriddenGuilds = overriddenGuilds // Guilds that have thier limits overridden

exports.cookieAccessors = cookieAccessors // If restrictCookies is true in config, this is the list of permitted user IDs

exports.feedTracker = feedTracker // Used to track schedule assignment to feeds

exports.allScheduleWords = allScheduleWords // Holds all words across all schedules
