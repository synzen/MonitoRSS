const config = require('../../config.json')
const sqlType = config.feedManagement.sqlType.toLowerCase()

exports.selectTable = function(con, table, callback) {
  if (sqlType === "mysql") return con.query(`select "${table}" from information_schema.tables where table_schema = "${config.feedManagement.databaseName}" and table_name = "${table}"`, callback);
  else return con.all(`select name from sqlite_master where type = 'table' and name = '${table}'`, callback);
}

exports.createTable = function(con, table, callback) {
  if (sqlType === "mysql") {
    con.query(`create table if not exists \`${table}\` (link text)`, callback);
    return con.query(`alter table \`${table}\` convert to character set utf8 collate utf8_general_ci`);
  }
  else return con.run(`create table if not exists "${table}" (link text)`, callback);

}

exports.select = function(con, table, data, callback) {
  if (sqlType === 'mysql') {
    return con.query(`select * from \`${table}\` where link = ?`, [data], callback);
  }
  else return con.all(`select * from "${table}" where link = ?`, data, callback);
}

exports.insert = function(con, table, data, callback) {
  if (sqlType === "mysql") return con.query(`insert ignore into \`${table}\` (link) values (?)`, [data], callback);
  else {
    var prep = con.prepare(`insert into "${table}" (link) values (?)`);
    prep.run(data);
    prep.finalize();
    return callback();
  }
}

exports.end = function(con, callback, startingCycle) {
  if (sqlType === "mysql") return con.end(callback);
  else  {
    if (!startingCycle) con.close();
    return callback();
  }
}

exports.dropTable = function(db, table, callback) {

  if (sqlType === "mysql") {
    const mysql = require('mysql')
    const credentials = require('../../mysqlCred.json');
    credentials.database = db;

    var con = mysql.createConnection(credentials);

    con.connect(function(err) {
      if (err) throw err;
    })

    con.query(`drop table if exists \`${table}\``, function(err) {
      if (err) console.log(err);
    })

    con.end(function(err) {
      if(err) console.log(err);
      else return callback();
    })
  }

  else {
    const sqlite3 = require('sqlite3').verbose()
    var con = new sqlite3.Database(`./${config.feedManagement.databaseName}.db`, dropTable);

    function dropTable() {
      con.run(`drop table if exists "${table}"`, closeDb)
    }

    function closeDb() {
      con.close()
      callback()
    }

  }
}
