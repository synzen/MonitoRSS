// Asks the user to input a valid role
// Invalid roles are ones with duplicate names

const channelTracker = require('../../util/channelTracker.js')

module.exports = function(message, callback) {
  const channel = message.channel
  channel.sendMessage('Enter a valid case-sensitive role name. Roles with duplicate names cannot be used.')
  .then(m => {
    const filter = m => m.author.id == message.author.id
    const collector = channel.createCollector(filter,{time:240000})
    channelTracker.addCollector(message.channel.id)

    collector.on('message', function (m) {
      if (m.content.toLowerCase() === 'exit') {collector.stop('RSS Role Customization menu closed.'); return callback(false);}
      if (!channel.guild.roles.find('name', m.content) || channel.guild.roles.findAll('name', m.content).length > 1) return channel.sendMessage('That is not a valid role. Try again.').catch(err => console.log(`Promise Warning: printFeeds 2: ${err}`));
      collector.stop()
      callback(channel.guild.roles.find('name', m.content))
    })

    collector.on('end', (collected, reason) => {
      channelTracker.removeCollector(message.channel.id)
      if (reason === 'time') {
        channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
        return callback(false);
      }
      else if (reason !== 'user') {
        channel.sendMessage(reason);
        return callback(false);
      }
    });
  }).catch(err => console.log(`Commands Info: (${message.guild.id}, ${message.guild.name}) => Could not send specify role prompt. (${err})`))
}
