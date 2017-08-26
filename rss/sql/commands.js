const config = require('../../config.json')
const sqlType = config.feedManagement.sqlType.toLowerCase()
const defaultConfigs = require('../../util/configCheck.js').defaultConfigs

exports.selectTable = function (con, table, callback) {
  if (sqlType === 'mysql') return con.query(`select table_name from information_schema.tables where table_schema="${config.feedManagement.databaseName}" and table_name=?`, [table], callback)
  else return con.all(`select name from sqlite_master where type = 'table' and name = "${table}"`, callback)
}

exports.createTable = function (con, table, callback) {
  if (sqlType === 'mysql') {
    con.query(`create table if not exists ?? (DATE date, ID text, TITLE text)`, table, callback)
    return con.query(`alter table ?? convert to character set utf8 collate utf8_general_ci`, table)
  } else return con.run(`create table if not exists "${table}" (DATE text, ID text, TITLE text)`, callback)
}

exports.cleanTable = function (con, table, articleArray) {
  let qMarks = ''
  for (var i in articleArray) {
    qMarks += (i === '0') ? '? ' : ', ?'
  }
  // Delete articles that are not in current article list, and past X days of of original insertion
  const maxDaysAge = config.feedManagement.maxEntryAge ? config.feedManagement.maxEntryAge : defaultConfigs.feedManagement.maxEntryAge.default

  if (sqlType === 'mysql') {
    con.query(`delete from ?? where ID not in (${qMarks}) and DATE not between date_sub(now(), interval ${maxDaysAge} day) and now()`, [table].concat(articleArray), function (err, matches) {
      if (err) console.log('Datebase Cleaning ' + err)
    })
  } else {
    con.run(`delete from "${table}" where ID not in (${qMarks}) and DATE not between date('now', '-${maxDaysAge} day') and date('now')`, function (err) {
      if (err) console.log('Database Cleaning ' + err)
    })
  }
}

exports.selectId = function (con, table, articleId, callback) {
  if (sqlType === 'mysql') return con.query(`select ID from ?? where ID = ? limit 1`, [table, articleId], callback)
  else return con.all(`select ID from "${table}" where ID = ? limit 1`, articleId, callback)
}

exports.selectTitle = function (con, table, articleTitle, callback) {
  if (sqlType === 'mysql') return con.query(`select TITLE from ?? where TITLE = ? limit 1`, [table, articleTitle], callback)
  else return con.all(`select TITLE from "${table}" where TITLE = ? limit 1`, articleTitle, callback)
}

exports.insert = function (con, table, articleInfo, callback) {
  if (sqlType === 'mysql') return con.query(`insert ignore into ?? (DATE, ID, TITLE) values (curdate(), ?, ?)`, [table, articleInfo.id, articleInfo.title], callback)
  else con.run(`insert into "${table}" (DATE, ID, TITLE) values (date('now'), ?, ?)`, [articleInfo.id, articleInfo.title], callback)
}

exports.end = function (con, callback, startingCycle) {
  if (sqlType === 'mysql') return con.end(callback)
  else {
    if (!startingCycle) con.close()
    return callback()
  }
}

exports.dropTable = function (db, table) {
  if (sqlType === 'mysql') {
    const mysql = require('mysql')
    const credentials = require('../../mysqlCred.json')
    credentials.database = db

    const con = mysql.createConnection(credentials)

    con.connect(function (err) {
      if (err) throw err
    })

    con.query(`drop table if exists ??`, [table], function (err) {
      if (err) console.log(err)
    })

    con.end(function (err) {
      if (err) console.log(err)
    })
  } else {
    const sqlite3 = require('sqlite3').verbose()
    const con = new sqlite3.Database(`./${config.feedManagement.databaseName}.db`, function () {
      con.run(`drop table if exists "${table}"`, function () {
        con.close()
      })
    })
  }
}
