const Subscriber = require('../../structs/db/Subscriber.js')

/**
 * @param {string} feedID
 * @param {string} subscriberID 
 */
async function getSubscriberOfFeed (feedID, subscriberID) {
  const subscriber = await Subscriber.getByQuery({
    feed: feedID,
    id: subscriberID
  })
  return subscriber
}

/**
 * @param {Object<string, any>} data
 * @param {string} data.feed
 * @param {string} data.id
 * @param {'role'|'user'} data.type
 * @param {Object<string, string[]>} data.filters
 */
async function createSubscriber (data) {
  const subscriber = new Subscriber(data)
  await subscriber.save()
  return subscriber
}

/**
 * @param {string} id
 * @param {'role'|'user'} type 
 * @param {Object<string, any>} data 
 */
async function editSubscriber (feedID, subscriberID, data) {
  const subscriber = await Subscriber.getByQuery({
    feed: feedID,
    id: subscriberID
  })
  if (!subscriber) {
    throw new Error('Subscriber does not exist')
  }
  for (const key in data) {
    subscriber[key] = data[key]
  }
  await subscriber.save()
  return subscriber
}

/**
 * @param {string} id
 * @param {string} type
 */
async function deleteSubscriberOfFeed (feedID, subscriberID) {
  const subscriber = await Subscriber.getByQuery({
    feed: feedID,
    id: subscriberID
  })
  if (!subscriber) {
    throw new Error('Subscriber does not exist')
  }
  await subscriber.delete()
}

module.exports = {
  getSubscriberOfFeed,
  createSubscriber,
  editSubscriber,
  deleteSubscriberOfFeed
}
