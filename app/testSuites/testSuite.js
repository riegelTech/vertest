'use strict';

const uuid = require('uuidv4');

class TestSuite {
	constructor({_id = uuid(), name = '', tests = {}}) {
		this._id = _id;
		this.name = name;
		this.tests = tests;
	}
}

module.exports = TestSuite;