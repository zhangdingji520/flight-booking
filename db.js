const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
}

function write(name, data) {
  fs.writeFileSync(path.join(dataDir, name), JSON.stringify(data, null, 2));
}

module.exports = { read, write };
