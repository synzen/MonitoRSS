const Subscriber = require('../structs/db/Subscriber.js')
const createLogger = require('../util/logger/create.js')

module.exports = async role => {
  const log = createLogger(role.guild.shard.id)
  try {
    const subscribers = await Subscriber.getManyBy('id', role.id)
    subscribers.forEach(subscriber => {
      subscriber.delete()
        .catch(err => {
          log.error(err, 'Failed to delete subscriber after role deletion')
        })
    })
  } catch (err) {
    log.error(err, 'Role could not be removed from config by guild role deletion')
  }
}
