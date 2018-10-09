// Asks the user to input a valid role
// Invalid roles are ones with duplicate names

const channelTracker = require('../../util/channelTracker.js')
const log = require('../../util/logger.js')

module.exports = (message, msgHandler, callback) => {
  const channel = message.channel
  channel.send('Enter a valid case-sensitive role name. Invalid roles are ones with duplicate names and the `@everyone` role.')
    .then(m => {
      msgHandler.add(m)
      const filter = m => m.author.id === message.author.id
      const collector = channel.createMessageCollector(filter, { time: 240000 })
      channelTracker.add(message.channel.id)

      collector.on('collect', m => {
        msgHandler.add(m)
        if (m.content.toLowerCase() === 'exit') return collector.stop('Role customization menu closed.')
        const findSingleRole = channel.guild.roles.find(r => r.name === m.content)
        const findAllRoles = channel.guild.roles.filter(r => r.name === m.content)
        if (!findSingleRole || findAllRoles.length > 1 || m.content === '@everyone') return channel.send('That is not a valid role. Try again.').then(m => msgHandler.add(m)).catch(err => log.command.warning(`getRole 1`, channel.guild, err))
        collector.stop()
        callback(findSingleRole)
      })

      collector.on('end', (collected, reason) => {
        channelTracker.remove(message.channel.id)
        if (reason === 'user') return
        if (reason === 'time') {
          channel.send(`I have closed the menu due to inactivity.`).catch(err => log.command.warning(`Unable to send expired menu message`, message.guild, err))
          callback()
        } else if (reason !== 'user') {
          channel.send(reason).then(m => m.delete(6000).catch(err => log.command.warning(`getRole 2`, message.guild, err))).catch(err => log.comamnd.warning('getRole 3', message.guild, err))
          callback()
        }
        msgHandler.deleteAll(message.channel)
      })
    }).catch(err => log.command.warning(`Could not send specify role prompt`, message.guild, err))
}
