'use strict';

const uuid = require('uuidv4');

class TestSuite {
	constructor({_id = uuid(), name = '', repoAddress = '', tests = [], gitBranch = ''}) {
		this._id = _id;
		this.name = name;
		this.repoAddress = repoAddress;
		this.tests = tests;
		this.gitBranch = gitBranch;
	}
}

module.exports = TestSuite;
