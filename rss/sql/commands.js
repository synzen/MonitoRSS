
const rssConfig = require('../../config.json')
var mysql, sqlite3
let sqlType = rssConfig.sqlType.toLowerCase()


if (sqlType == "mysql") mysql = require('mysql');
else sqlite3 = require('sqlite3').verbose();


exports.selectTable = function (con, table, callback) {
  if (sqlType == "mysql")
    return con.query(`select "${table}" from information_schema.tables where table_schema = "${rssConfig.databaseName}" and table_name = "${table}"`, callback);

  else
    return con.all(`select name from sqlite_master where type = 'table' and name = '${table}'`, callback);
}

exports.createTable = function (con, table, callback) {
  if (sqlType == "mysql")
    return con.query('create table if not exists `' + table + '` (link text)', callback)

  else
    return con.run(`create table if not exists "${table}" (link text)`, callback);

}

exports.select = function (con, table, data, callback) {
  if (sqlType == "mysql")
    return con.query(`select * from \`${table}\` where link like "%${data}%"`, callback);

  else
    return con.all(`select * from "${table}" where link like '%${data}%'`, callback);
}

exports.insert = function (con, table, data, callback) {
  if (sqlType == "mysql")
    return con.query(`insert ignore into \`${table}\` (link) values (?)`, [data], callback);

  else {
    var prep = con.prepare(`insert into "${table}" (link) values (?)`);
    prep.run(data);
    prep.finalize();
    return callback();
  }
}

exports.end = function (con, callback) {
  if (sqlType == "mysql")
    return con.end(callback);

  else  {
    con.close();
    return callback();
  }
}

exports.dropTable = function (db, table, callback) {

  if (sqlType == "mysql") {
    var credentials = require('../../mysqlCred.json')
    credentials.database = db

    var con = mysql.createConnection(credentials);

    con.connect(function (err) {
      if (err) console.log(err);
      //else console.log(`RSS Info: Starting removal of ${table} from config`)
    })

    con.query(`drop table if exists \`${table}\``, function (err) {
      if (err) console.log(err);
    })

    con.end(function (err) {
      if(err) console.log(err);
      else return console.log(`RSS Info: Successfully removed ${table} from config`)
    })
  }

  else {
    var con = new sqlite3.Database(`./${rssConfig.databaseName}.db`, dropTable);
    //console.log(`RSS Info: Starting removal of ${table} from config`);

    function dropTable() {
      con.run(`drop table if exists "${table}"`, closeDb)
    }

    function closeDb() {
      con.close()
      callback()
    }

  }
}
