/*
    Used to store data for various aperations across multiple files
*/
const fs = require('fs')
const currentGuilds = new Map()
const linkTracker = {}
const allScheduleWords = []
let deletedFeeds = []
let cookieAccessors = {ids: []} // User IDs
let webhookAccessors = {ids: []} // Guild IDs
let overriddenGuilds = {}
let blacklistGuilds = {ids: []}
let failedLinks = {}

try {
  cookieAccessors = JSON.parse(fs.readFileSync('./settings/cookieAccessors.json'))
} catch (e) {
  cookieAccessors = {ids: []}
}

try {
  webhookAccessors = JSON.parse(fs.readFileSync('./settings/webhookAccessors.json'))
} catch (e) {
  webhookAccessors = {ids: []}
}

try {
  overriddenGuilds = JSON.parse(fs.readFileSync('./settings/limitOverrides.json'))
} catch (e) {
  overriddenGuilds = {}
}

try {
  blacklistGuilds = JSON.parse(fs.readFileSync('./settings/blacklist.json'))
} catch (e) {
  blacklistGuilds = {ids: []}
}

try {
  failedLinks = JSON.parse(fs.readFileSync('./settings/failedLinks.json'))
} catch (e) {
  failedLinks = {}
}

exports.blacklistGuilds = blacklistGuilds

exports.currentGuilds = currentGuilds // To hold all guild profiles

exports.deletedFeeds = deletedFeeds // Any deleted rssNames to check during sendToDiscord if it was deleted during a cycle

exports.cookieAccessors = cookieAccessors // If restrictCookies is true in config, this is the list of permitted user IDs

exports.webhookAccessors = webhookAccessors

exports.overriddenGuilds = overriddenGuilds // To track guilds with overridden limits

exports.linkTracker = linkTracker // To track schedule assignment to links

exports.allScheduleWords = allScheduleWords // Holds all words across all schedules

exports.failedLinks = failedLinks
