const IPC = require('../../util/ipc')

module.exports = async () => {
  IPC.send(IPC.TYPES.KILL)
}
