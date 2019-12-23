'use strict';

const Path = require('path');

const {lowestCommonAncestor} = require('lowest-common-ancestor');
const uuid = require('uuidv4');

const utils = require('../utils');

class TestCase {
	constructor({testFilePath = '', basePath = '', content= '', status = TestCase.STATUSES.TODO, user = null}) {
		this.basePath = basePath;
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
		this.content = await utils.readFile(Path.resolve(this.basePath, this.testFilePath), 'utf8');
	}
}

class TestSuite {
	constructor({_id = uuid(), name = '', repoAddress = '', tests = [], gitBranch = '', gitCommitSha = '', status = TestSuite.STATUSES.UP_TO_DATE}) {
		this._id = _id;
		this.name = name;
		this.repoAddress = repoAddress;
		this.gitBranch = gitBranch;
		this.gitCommitSha = gitCommitSha;
		this.status = status;
		this.tests = tests.map(testCase =>  {
			return testCase instanceof TestCase ? testCase : new TestCase(testCase);
		});
		this.baseDir = lowestCommonAncestor(...this.tests.map(testCase => testCase.testFilePath));
	}

	collectTests() {
		return Promise.all(this.tests.map(testCase => testCase.fetchTestContent()));
	}

	static get STATUSES() {
		return {
			UP_TO_DATE: 'up_to_date',
			TO_UPDATE: 'to_update',
			UPDATING: 'updating'
		};
	}
}

module.exports = {
	TestSuite,
	TestCase
};
