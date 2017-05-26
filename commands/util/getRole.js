// Asks the user to input a valid role
// Invalid roles are ones with duplicate names

const channelTracker = require('../../util/channelTracker.js')

module.exports = function (message, msgHandler, callback) {
  const channel = message.channel
  channel.send('Enter a valid case-sensitive role name. Invalid roles are ones with duplicate names and the `@everyone` role.')
  .then(function (m) {
    msgHandler.add(m)
    const filter = m => m.author.id === message.author.id
    const collector = channel.createMessageCollector(filter, {time: 240000})
    channelTracker.add(message.channel.id)

    collector.on('collect', function (m) {
      msgHandler.add(m)
      if (m.content.toLowerCase() === 'exit') return collector.stop('Role customization menu closed.')
      if (!channel.guild.roles.find('name', m.content) || channel.guild.roles.findAll('name', m.content).length > 1 || m.content === '@everyone') return channel.send('That is not a valid role. Try again.').then(m => msgHandler.add(m)).catch(err => console.log(`Promise Warning: chooseFeed 2: ${err}`))
      collector.stop()
      callback(channel.guild.roles.find('name', m.content))
    })

    collector.on('end', function (collected, reason) {
      channelTracker.remove(message.channel.id)
      if (reason === 'user') return
      if (reason === 'time') {
        channel.send(`I have closed the menu due to inactivity.`).catch(err => console.log(`Promise Warning: Unable to send expired menu message (${err})`))
        callback()
      } else if (reason !== 'user') {
        channel.send(reason).then(m => m.delete(6000))
        callback()
      }
      msgHandler.deleteAll(message.channel)
    })
  }).catch(err => console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => Could not send specify role prompt. (${err})`))
}
