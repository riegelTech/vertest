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

	get isFinished() {
		return this.status === TestCase.STATUSES.SUCCESS
			|| this.status === TestCase.STATUSES.FAILED;
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
		this.setTests(tests);
		this.baseDir = lowestCommonAncestor(...this.tests.map(testCase => testCase.testFilePath));

		const finished = this.tests.reduce((total, testCase) => {
			if (testCase.isFinished) {
				total ++;
			}
			return total;
		}, 0);
		const total = this.tests.length;
		const percent = total === 0 ? 0 : Math.round((finished / total) * 100 * 100) / 100;
		this.advancement = {
			finished,
			total,
			percent
		};
	}

	collectTests() {
		return Promise.all(this.tests.map(testCase => testCase.fetchTestContent()));
	}

	getTestCaseByFilePath(testFilePath) {
		return this.tests.find(testCase => testCase.testFilePath === testFilePath);
	}

	setTests(tests) {
		this.tests = tests.map(testCase =>  {
			return testCase instanceof TestCase ? testCase : new TestCase(testCase);
		});
	}

	addTestCase(basePath, testFilePath) {
		this.tests.push(new TestCase({
			testFilePath,
			basePath
		}));
	}

	removeTestCase(testFilePath) {
		const testIndex = this.tests.findIndex(testCase => testCase.testFilePath === testFilePath);
		if (testIndex === undefined) {
			throw new Error(`Unable to find test with file path ${testFilePath}`);
		}
		this.tests.splice(testIndex, 1);
	}

	static get STATUSES() {
		return {
			UP_TO_DATE: 'up_to_date',
			TO_UPDATE: 'to_update',
			TO_TOGGLE_BRANCH: 'to_toggle_branch',
			UPDATING: 'updating'
		};
	}
}

module.exports = {
	TestSuite,
	TestCase
};
