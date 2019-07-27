'use strict';

const uuid = require('uuidv4');

class TestSuite {
	constructor({_id = uuid(), name = '', tests = [], gitBranch = ''}) {
		this._id = _id;
		this.name = name;
		this.tests = tests;
		this.gitBranch = gitBranch;
	}
}

module.exports = TestSuite;
