const credentials = require('../../mysqlCred.json')
const config = require('../../config.json')
const sqlType = config.feedManagement.sqlType.toLowerCase()
const sql = (sqlType === 'mysql') ? require('mysql') : require('sqlite3').verbose()

module.exports = function (callback) {
  if (sqlType === 'mysql') {
    let con = 0
    let attempts = 0
  // let con;

    ;(function connect (finalErr) {
      if (attempts === 9 && finalErr) throw new Error(`Could not connect to database after 10 attempts, terminating. (${finalErr})`)
      con = sql.createConnection(credentials) // MySQL connections will automatically close unless new connections are made

      con.connect(function (err) {
        if (err) {
          console.log(`Error connecting to database ${config.feedManagement.databaseName} (${err}). Attempting to reconnect.`)
          attempts++
          return setTimeout(connect, 2000, err)
          // return callback(err);
        }

        con.query(`create database if not exists \`${config.feedManagement.databaseName}\``, function (err) {
          if (err) throw err
        })
        con.query(`use \`${config.feedManagement.databaseName}\``, function (err) {
          if (err) throw err
        })
        con.query(`set collation_connection = 'utf8_general_ci'`, function (err) {
          if (err) throw err
        })
        callback()
      })

      con.on('error', function (err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
          connect(err)
          attempts++
        } else throw err
      })
    })()
    return con
  } else if (sqlType === 'sqlite3') { // So much simpler!
    return new sql.Database(`./${config.feedManagement.databaseName}.db`, callback)
  } else throw new Error('Warning! SQL type is not correctly defined in config, terminating.')
}
