const fs = require('fs');


module.exports = function (realFile, inFile) {

  fs.writeFileSync(realFile, JSON.stringify(inFile, null, 2));

}
