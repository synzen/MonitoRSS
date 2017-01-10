const fs = require('fs');


module.exports = function (realFile, inFile) {
  fs.writeFile(realFile, JSON.stringify(inFile, null, 2), function (err) {
    if (err) return console.log(err);
  });
  //fs.writeFileSync(realFile, JSON.stringify(inFile, null, 2));

}
