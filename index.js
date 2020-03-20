const Client = require('./src/structs/Client.js')
const ClientManager = require('./src/structs/ClientManager.js')
const v6 = require('./scripts/pre_v6.js')

exports.Client = Client
exports.ClientManager = ClientManager
exports.migrations = {
  v6
}
