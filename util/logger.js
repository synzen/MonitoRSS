const Discord = require('discord.js')
const COLORS = {
  Error: '\x1b[31m%s\x1b[0m',
  Warning: '\x1b[33m%s\x1b[0m',
  Debug: '\x1b[33m%s\x1b[0m'
}
const CONSTRUCTORS = [Discord.Guild, Discord.TextChannel, Discord.Role, Discord.User]
const PREFIXES = ['G', 'C', 'R', 'U']
const TYPES = ['Command', 'Guild', 'RSS', 'INIT', 'General', 'Debug']
const LEVELS = ['Error', 'Warning', 'Info']
const MAXLEN = TYPES.reduce((a, b) => a.length > b.length ? a : b).length + LEVELS.reduce((a, b) => a.length > b.length ? a : b).length + 1 // Calculate uniform spacing

class Logger {
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
    for (let i = intro.length; i < MAXLEN; ++i) {
      intro += ' '
    }
    const color = COLORS[level]
    return (contents, ...details) => {
      const extra = this._parseDetails(details)
      if (color) console.log(color, `${intro} | ${extra.identifier}${contents}${extra.err ? ` (${extra.err})` : ''}`)
      else console.log(`${intro} | ${extra.identifier}${contents}${extra.err ? ` (${extra.err})` : ''}`)
    }
  }
}

TYPES.forEach(type => {
  exports[type.toLowerCase()] = new Logger(type)
})
