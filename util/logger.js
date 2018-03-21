const Discord = require('discord.js')
const COLORS = {
  Error: '\x1b[31m',
  Warning: '\x1b[33m',
  Debug: '\x1b[33m',
  reset: '\x1b[0m'
}
const CONSTRUCTORS = [Discord.Guild, Discord.TextChannel, Discord.Role, Discord.User]
const LOG_DATES = require('../config.json').log.dates === true
const PREFIXES = ['G', 'C', 'R', 'U']
const TYPES = ['Command', 'Guild', 'Cycle', 'INIT', 'General', 'Debug', 'Controller']
const LEVELS = ['Error', 'Warning', 'Info']
const MAXLEN = TYPES.reduce((a, b) => a.length > b.length ? a : b).length + LEVELS.reduce((a, b) => a.length > b.length ? a : b).length + 1 // Calculate uniform spacing

function formatConsoleDate (date) {
  // http://stackoverflow.com/questions/18814221/adding-timestamps-to-all-console-messages
  const hour = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()
  const milliseconds = date.getMilliseconds()
  return `[${((hour < 10) ? '0' + hour : hour)}:${((minutes < 10) ? '0' + minutes : minutes)}:${((seconds < 10) ? '0' + seconds : seconds)}.${('00' + milliseconds).slice(-3)}] `
}

class _Logger {
  constructor (type) {
    this.type = type
    LEVELS.forEach(level => {
      this[level.toLowerCase()] = this._log(level)
    })
  }

  _parseDetails (details) {
    if (details.length === 0) return { identifier: '' }
    let error
    let det = ''
    for (var q = 0; q < details.length; ++q) {
      const item = details[q]
      if (!item) continue
      const i = CONSTRUCTORS.indexOf(item.constructor)
      if (i === -1) {
        if (item instanceof Error) error = item
        continue
      }
      const pre = PREFIXES[i]
      det += item.id && (item.name || item.username) ? `(${pre}: ${item.id}, ${item.name || item.username}) ` : item.id ? `(${pre} ${item.id}) ` : item.name ? `(${pre} ${item.name}) ` : ''
    }
    return { identifier: det, err: error }
  }

  _log (level) {
    let intro = `${this.type} ${level}`
    for (let i = intro.length; i < MAXLEN; ++i) intro += ' '
    const color = COLORS[level] ? COLORS[level] : ''
    const reset = COLORS.reset ? COLORS.reset : ''
    return (contents, ...details) => {
      const extra = this._parseDetails(details)
      console.log(`${LOG_DATES ? formatConsoleDate(new Date()) : ''}${color}${intro}${reset} | ${extra.identifier}${contents}${extra.err ? ` (${extra.err}${extra.err.code ? `, Code ${extra.err.code}` : ''})` : ''}`)
    }
  }
}

TYPES.forEach(type => {
  exports[type.toLowerCase()] = new _Logger(type)
})
