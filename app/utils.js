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
    // not found
    'ENOUSERFOUND': HTTP_CODES.NOTFOUND,
    'EUSERNOTFOUND': HTTP_CODES.NOTFOUND,
    'ETESTCASENOTFOUND': HTTP_CODES.NOTFOUND,
    'ETESTSUITENOTFOUND': HTTP_CODES.NOTFOUND,
    // bad request
    'EBADUSERDATA': HTTP_CODES.REFUSED,
    // resource locked
    'EUSERNOTEDITABLE': HTTP_CODES.LOCKED,
    // conflicts
    'EUSEREXISTS': HTTP_CODES.CONFLICT
};

module.exports = {
    // fs
    readFile: util.promisify(fs.readFile),
    mkdir: util.promisify(fs.mkdir),
    exists: util.promisify(fs.exists),
    // glob
    glob: util.promisify(glob),
    // http responses codes
    getHttpCode(errorCode) {
        return RESPONSE_HTTP_CODES[errorCode] || RESPONSE_HTTP_CODES.DEFAULT;
    }
};