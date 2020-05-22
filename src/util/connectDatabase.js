const fs = require('fs')
const mongoose = require('mongoose')
const BUFFER_CONFIGS = ['sslCA', 'sslCRL', 'sslCert', 'sslKey']

function readBuffers (connectionSettings) {
  const buffers = {}
  for (const name of BUFFER_CONFIGS) {
    if (connectionSettings[name]) {
      buffers[name] = fs.readFileSync(connectionSettings[name])
    }
  }
  return buffers
}

module.exports = async (uri, userOptions) => {
  const connectionSettings = userOptions || {}
  let buffers = {}
  if (Object.keys(connectionSettings).length > 0) {
    buffers = readBuffers(connectionSettings)
  }
  const options = {
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
    useNewUrlParser: true,
    socketTimeoutMS: 90000,
    ...userOptions,
    ...connectionSettings,
    ...buffers
  }
  return mongoose.createConnection(uri, options)
}
