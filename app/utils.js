'use strict';

const fs = require('fs');
const util = require('util');

module.exports = {
    readFile: util.promisify(fs.readFile),
    mkdir: util.promisify(fs.mkdir),
    exists: util.promisify(fs.exists)
};