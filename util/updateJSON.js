const fs = require('fs');


exports.updateFile = function (realFile, inFile, cacheFile) {
  try {
    delete require.cache[require.resolve(cacheFile)]
  }
  catch (e) {console.log(e)}

  fs.writeFile(realFile, JSON.stringify(inFile, null, 2), function (err) {
    if (err) return console.log(err);
  });
  //fs.writeFileSync(realFile, JSON.stringify(inFile, null, 2))

}

exports.deleteFile = function(file) {
  fs.unlink(file, function(err) {
    if (err) return console.log(err)
    return console.log(`RSS File Ops: Deleted ${file} due to zero sources detected..`)
  })
}
