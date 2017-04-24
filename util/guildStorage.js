/*
    Used to control feed retrieval cycle on disconnects, file updates and store guild profiles
*/

const config = require('../config.json')
const currentGuilds = new Map()
const changedGuilds = new Map()
const deletedGuilds = []
const sourceList = new Map()

exports.currentGuilds = currentGuilds // Object for holding all guild profiles

exports.changedGuilds = changedGuilds // Hold any changed guild data here sent from child process

exports.deletedGuilds = deletedGuilds

exports.sourceList = sourceList
