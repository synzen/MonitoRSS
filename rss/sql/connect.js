const mysqlCmds = require('./commands.js')
var rssConfig = require('../../config.json')

var mysql, sqlite3
if (rssConfig.sqlType.toLowerCase() == "mysql") mysql = require('mysql');
else if (rssConfig.sqlType.toLowerCase() == "sqlite3") sqlite3 = require('sqlite3').verbose();

const credentials = require('../../mysqlCred.json')


module.exports = function (callback) {
  if (typeof rssConfig.sqlType !== "string") return null;
  else if (rssConfig.sqlType.toLowerCase() == "mysql") {
  var con, iterations = 0;

    (function startDataProcessing() {
      con = mysql.createConnection(credentials); //MySQL connections will automatically close unless new connections are made

      con.connect(function(err){
        if(err){
          throw err;
          console.log('Error connecting to database ' + rssConfig.databaseName + '. Attempting to reconnect.');
          //setTimeout(startDataProcessing, 2000);
        }
        else {
          con.query('create database if not exists `' + rssConfig.databaseName + '`', function (err) {
            if (err) throw err;
          })
          con.query('use ' + rssConfig.databaseName, function (err) {
            if (err) throw err;
          })
          callback();

        }
      });

      // con.on('error', function(err) {
      //   if(err.code === 'PROTOCOL_CONNECTION_LOST') {
      //     startDataProcessing();
      //     iterations++;
      //   }
      //   else throw err;
      // });
    })()

    return con;

  }


  //so much simpler!
  else if (rssConfig.sqlType.toLowerCase() == "sqlite3") {
    return new sqlite3.Database(`./${rssConfig.databaseName}.db`, callback);
  }
  else return null;
}
