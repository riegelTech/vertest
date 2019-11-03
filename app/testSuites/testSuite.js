'use strict';

const uuid = require('uuidv4');

const utils = require('../utils');

class TestCase {
	constructor({testFilePath = '', status = TestCase.STATUSES.TODO, userUuid = null}) {
		this._testFilePath = testFilePath;
		this._content = '';
		this._status = status;
		this._userUuid = userUuid;
	}

	static get STATUSES() {
		return {
			TODO: 0,
			IN_PROGRESS: 1,
			BLOCKED: 3,
			SUCCESS: 4,
			FAILED: 5
		}
	}

	get status() {
		return this._status;
	}

	get content() {
		return this._content;
	}

	get userUuid() {
		return this._userUuid;
	}

	async fetchTestContent() {
		this._content = await utils.readFile(this._testFilePath, 'utf8');
	}
}

class TestSuite {
	constructor({_id = uuid(), name = '', repoAddress = '', testsFilesPaths = [], gitBranch = ''}) {
		this._id = _id;
		this.name = name;
		this.repoAddress = repoAddress;
		this.gitBranch = gitBranch;
		this.tests = testsFilesPaths.map(testFilePath => new TestCase({testFilePath}));
	}

	collectTests() {
		return Promise.all(this.tests.map(testCase => testCase.fetchTestContent()));
	}
}

module.exports = TestSuite;
