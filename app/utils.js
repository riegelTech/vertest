'use strict';

const fs = require('fs');
const util = require('util');

const glob = require('glob');

const HTTP_CODES = {
    INTERNAL: 500,
    REFUSED: 403,
    NOTFOUND: 404,
    CONFLICT: 409,
    LOCKED: 423
};

const RESPONSE_HTTP_CODES = {
    // generics
    DEFAULT: HTTP_CODES.INTERNAL,
    LOCKED: HTTP_CODES.LOCKED,
    REFUSED: HTTP_CODES.REFUSED,
    // not found
    'ENOTFOUND': HTTP_CODES.NOTFOUND,
    'ENOUSERFOUND': HTTP_CODES.NOTFOUND,
    'EUSERNOTFOUND': HTTP_CODES.NOTFOUND,
    'ETESTCASENOTFOUND': HTTP_CODES.NOTFOUND,
    'ETESTSUITENOTFOUND': HTTP_CODES.NOTFOUND,
    // bad request
    'EINVALIDPARAM': HTTP_CODES.REFUSED,
    'EBADUSERDATA': HTTP_CODES.REFUSED,
    'EREPOSITORYCLONEERROR': HTTP_CODES.REFUSED,
    // resource locked
    'EUSERNOTEDITABLE': HTTP_CODES.LOCKED,
    // conflicts
    'EUSEREXISTS': HTTP_CODES.CONFLICT,
    'EDUPLICATEENTRY': HTTP_CODES.REFUSED
};

module.exports = {
    // fs
    access: util.promisify(fs.access),
    readDir: util.promisify(fs.readdir),
    readFile: util.promisify(fs.readFile),
    mkdir: util.promisify(fs.mkdir),
    exists: util.promisify(fs.exists),
    stat: util.promisify(fs.stat),
    writeFile: util.promisify(fs.writeFile),
    // glob
    glob: util.promisify(glob),
    // http responses codes
    RESPONSE_HTTP_CODES,
    getHttpCode(errorCode) {
        return RESPONSE_HTTP_CODES[errorCode] || RESPONSE_HTTP_CODES.DEFAULT;
    }
};