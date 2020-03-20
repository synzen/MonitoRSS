const Client = require('./src/structs/Client.js')
const ClientManager = require('./src/structs/ClientManager.js')
const validateConfig = require('./src/util/config/schema').validate

const v6 = require('./scripts/pre_v6.js')

exports.Client = Client
exports.ClientManager = ClientManager
exports.migrations = {
  v6
}
exports.validateConfig = validateConfig
