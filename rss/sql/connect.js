const mysqlCmds = require('./commands.js')
var config = require('../../config.json')

var mysql, sqlite3
if (config.feedManagement.sqlType.toLowerCase() == "mysql") mysql = require('mysql');
else if (config.feedManagement.sqlType.toLowerCase() == "sqlite3") sqlite3 = require('sqlite3').verbose();

const credentials = require('../../mysqlCred.json')


module.exports = function (callback) {
  if (typeof config.feedManagement.sqlType !== "string") return null;
  else if (config.feedManagement.sqlType.toLowerCase() === "mysql") {
  var con, attempts = 0;

    (function connect (finalErr) {
      if (attempts === 9 && finalErr) throw `Could not connect to database after 10 attempts, terminating. (${finalErr})`;
      con = mysql.createConnection(credentials); //MySQL connections will automatically close unless new connections are made

      con.connect(function(err){
        if(err) {
          console.log(`Error connecting to database ${config.feedManagement.databaseName} (${err}). Attempting to reconnect.`);
          attempts++;
          return setTimeout(connect, 2000, err);
        }

        con.query(`create database if not exists \`${config.feedManagement.databaseName}\``, function (err) {
          if (err) throw err;
        })
        con.query(`use ${config.feedManagement.databaseName}`, function (err) {
          if (err) throw err;
        })
        con.query(`set collation_connection = 'utf8_general_ci'`, function (rtt) {
          if (err) throw err;
        })
        callback();
      });

      con.on('error', function (err) {
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
  else if (config.feedManagement.sqlType.toLowerCase() == "sqlite3") {
    return new sqlite3.Database(`./${config.feedManagement.databaseName}.db`, callback);
  }
  else throw 'Warning! SQL type is not correctly defined in config, terminating.';
}
