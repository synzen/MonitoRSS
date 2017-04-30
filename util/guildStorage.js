/*
    Used to control feed retrieval cycle on disconnects, file updates and store guild profiles
*/

const config = require('../config.json')
const overriddenGuilds = new Map()
const currentGuilds = new Map()
const changedGuilds = new Map()
const deletedGuilds = []
const sourceList = new Map()
const modSourceList = new Map()

exports.currentGuilds = currentGuilds // Object for holding all guild profiles

exports.changedGuilds = changedGuilds // Hold any changed guild data here sent from child process

exports.deletedGuilds = deletedGuilds

exports.overriddenGuilds = overriddenGuilds // Guilds that have thier limits overridden

exports.sourceList = sourceList // Regular source list, will be optimized for best performance in link fetching

exports.modSourceList = modSourceList // 'Modded' source list with unique settings under 'advanced' key. Not optimized.
