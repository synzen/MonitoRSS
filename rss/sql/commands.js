const config = require('../../config.json')
const sqlType = config.feedManagement.sqlType.toLowerCase()

exports.selectTable = function(con, table, callback) {
  if (sqlType === "mysql") return con.query(`select "${table}" from information_schema.tables where table_schema = "${config.feedManagement.databaseName}" and table_name = "${table}"`, callback);
  else return con.all(`select name from sqlite_master where type = 'table' and name = '${table}'`, callback);
}

exports.createTable = function(con, table, callback) {
  if (sqlType === "mysql") {
    con.query(`create table if not exists \`${table}\` (ID text, TITLE text)`, callback);
    return con.query(`alter table \`${table}\` convert to character set utf8 collate utf8_general_ci`);
  }
  else return con.run(`create table if not exists "${table}" (ID text, TITLE text)`, callback);

}

exports.selectId = function(con, table, articleId, callback) {
  if (sqlType === 'mysql') return con.query(`select * from \`${table}\` where ID = ?`, [articleId], callback);
  else return con.all(`select * from "${table}" where ID = ?`, articleId, callback);
}

exports.selectTitle = function(con, table, articleTitle, callback) {
  if (sqlType === 'mysql') return con.query(`select * from \`${table}\` where TITLE = ?`, [articleTitle], callback);
  else return con.all(`select * from "${table}" where TITLE = ?`, articleTitle, callback);
}

exports.insert = function(con, table, articleInfo, callback) {
  if (sqlType === "mysql") return con.query(`insert ignore into \`${table}\` (ID, TITLE) values (?, ?)`, [articleInfo.id, articleInfo.title], callback);
  else {
    var prep = con.prepare(`insert into "${table}" (ID, TITLE) values (?, ?)`);
    prep.run(articleInfo.id, articleInfo.title);
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

exports.dropTable = function(db, table) {

  if (sqlType === "mysql") {
    const mysql = require('mysql');
    const credentials = require('../../mysqlCred.json');
    credentials.database = db;

    const con = mysql.createConnection(credentials);

    con.connect(function(err) {
      if (err) throw err;
    })

    con.query(`drop table if exists \`${table}\``, function(err) {
      if (err) console.log(err);
    })

    con.end(function(err) {
      if(err) console.log(err);
    })
  }

  else {
    const sqlite3 = require('sqlite3').verbose()
    const con = new sqlite3.Database(`./${config.feedManagement.databaseName}.db`, dropTable);

    function dropTable() {
      con.run(`drop table if exists "${table}"`, closeDb)
    }

    function closeDb() {
      con.close()
    }

  }
}
