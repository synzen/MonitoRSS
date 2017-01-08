/*
    MySQL connections are going to disconnect, through experimentation,
    after about 7-8 hours. I have tried to go around this through
    creating new connections on a loop should it fail, but alas it is to
    no avail and will fail even on reconnection attempts.

    SQLite3 should be working without any problems.

*/
const mysqlCmds = require('./commands.js')
var rssConfig = require('../../config.json')
var rssList = rssConfig.sources

var mysql, sqlite3
if (rssConfig.sqlType.toLowerCase() == "mysql") mysql = require('mysql');
else if (rssConfig.sqlType.toLowerCase() == "sqlite3") sqlite3 = require('sqlite3').verbose();

const credentials = require('../../mysqlCred.json')


module.exports = function (createTable, checkTableExists, checkingTables) {
  if (typeof rssConfig.sqlType !== "string") return null;
  else if (rssConfig.sqlType.toLowerCase() == "mysql") {
  var con, iterations = 0;

    (function startDataProcessing() {
      con = mysql.createConnection(credentials); //MySQL connections will automatically close unless new connections are made

      con.connect(function(err){
        if(err){
          // console.log(err.code);
          // console.log(err.fatal);
          console.log('Error connecting to database ' + rssConfig.databaseName + '. Attempting to reconnect.');
          setTimeout(startDataProcessing, 2000);
          if (iterations == 50) throw err;
        }
        else {
          con.query('create database if not exists `' + rssConfig.databaseName + '`', function (err) {
            if (err) throw err;
          })
          con.query('use ' + rssConfig.databaseName, function (err) {
            if (err) throw err;
          })
          if (checkingTables) checkTableExists();
          else createTable();

        }
      });

      con.on('error', function(err) {
        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
          startDataProcessing();
          iterations++;
        }
        else throw err;
      });
    })()

    return con;

  }


  //so much simpler!
  else if (rssConfig.sqlType.toLowerCase() == "sqlite3") {
    if (checkingTables) return new sqlite3.Database(`./${rssConfig.databaseName}.db`, checkTableExists);
    else return new sqlite3.Database(`./${rssConfig.databaseName}.db`, createTable);
  }
  else return null;
}
