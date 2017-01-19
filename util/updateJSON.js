const fs = require('fs');

exports.exists = function (file) {
  return fs.existsSync(file)
}

exports.updateFile = function (realFile, inFile, cacheFile) {
  fs.writeFile(realFile, JSON.stringify(inFile, null, 2), function (err) {
    if (err) return console.log(err);

    try {
      delete require.cache[require.resolve(cacheFile)]
    }
    catch (e) {}

  });
}

exports.deleteFile = function(file, cacheFile, callback) {
  fs.unlink(file, function(err) {
    if (err) return console.log(err)

    try {
      delete require.cache[require.resolve(cacheFile)]
    }
    catch (e) {console.log(e)}

    return callback()
  })
}
