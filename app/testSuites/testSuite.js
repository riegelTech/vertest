'use strict';

const {lowestCommonAncestor} = require('lowest-common-ancestor');
const uuid = require('uuidv4');

const utils = require('../utils');

class TestCase {
	constructor({testFilePath = '', content= '', status = TestCase.STATUSES.TODO, user = null}) {
		this.testFilePath = testFilePath;
		this.content = content;
		this.status = status;
		this.user = user;
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

	async fetchTestContent() {
		this.content = await utils.readFile(this.testFilePath, 'utf8');
	}
}

class TestSuite {
	constructor({_id = uuid(), name = '', repoAddress = '', tests = [], gitBranch = ''}) {
		this._id = _id;
		this.name = name;
		this.repoAddress = repoAddress;
		this.gitBranch = gitBranch;
		this.tests = tests.map(testCase =>  {
			return testCase instanceof TestCase ? testCase : new TestCase(testCase);
		});
		this.baseDir = lowestCommonAncestor(...this.tests.map(testCase => testCase.testFilePath));

	}

	collectTests() {
		return Promise.all(this.tests.map(testCase => testCase.fetchTestContent()));
	}
}

module.exports = {
	TestSuite,
	TestCase
};
