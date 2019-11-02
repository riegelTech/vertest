'use strict';

const fs = require('fs');
const util = require('util');

const glob = require('glob');

module.exports = {
    // fs
    readFile: util.promisify(fs.readFile),
    mkdir: util.promisify(fs.mkdir),
    exists: util.promisify(fs.exists),
    // glob
    glob: util.promisify(glob)
};