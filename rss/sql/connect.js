const credentials = require('../../mysqlCred.json')
const config = require('../../config.json')
const sqlType = config.feedManagement.sqlType.toLowerCase()
const sql = (sqlType === 'mysql') ? require('mysql') : require('sqlite3').verbose()


module.exports = function(callback) {
  if (sqlType === 'mysql') {
  var con, attempts = 0;

    (function connect(finalErr) {
      if (attempts === 9 && finalErr) throw `Could not connect to database after 10 attempts, terminating. (${finalErr})`;
      con = sql.createConnection(credentials); //MySQL connections will automatically close unless new connections are made

      con.connect(function(err){
        if(err) {
          console.log(`Error connecting to database ${config.feedManagement.databaseName} (${err}). Attempting to reconnect.`);
          attempts++;
          return setTimeout(connect, 2000, err);
        }

        con.query(`create database if not exists \`${config.feedManagement.databaseName}\``, function(err) {
          if (err) throw err;
        })
        con.query(`use ${config.feedManagement.databaseName}`, function(err) {
          if (err) throw err;
        })
        con.query(`set collation_connection = 'utf8_general_ci'`, function(err) {
          if (err) throw err;
        })
        callback();
      });

      con.on('error', function(err) {
        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
          connect(err);
          attempts++;
        }
        else throw err;
      });
    })()
    return con;
  }

  //so much simpler!
  else if (sqlType == "sqlite3") {
    return new sql.Database(`./${config.feedManagement.databaseName}.db`, callback);
  }
  else throw 'Warning! SQL type is not correctly defined in config, terminating.';
}
