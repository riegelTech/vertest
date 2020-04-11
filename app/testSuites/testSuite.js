'use strict';

const Path = require('path');

const {lowestCommonAncestor} = require('lowest-common-ancestor');
const uuid = require('uuidv4');

const dbConnector = require('../db/db-connector');
const repoModule = require('../repositories/repositories');
const utils = require('../utils');

const TEST_SUITE_COLL_NAME = 'testSuites';

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
	constructor({_id = uuid(), name = '', repoProps = {}, tests = [], gitBranch = '', gitCommitSha = '', status = TestSuite.STATUSES.UP_TO_DATE}) {
		this._id = _id;
		this.name = name;
		this.repoAddress = repoProps.address;
		this.gitBranch = gitBranch;
		this.gitCommitSha = gitCommitSha;
		this.status = status;
		this.tests = tests;
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

		this.repository = new repoModule.Repository({
			...repoProps,
			name: this._id,
			testDirs: []
		})
	}

	async init() {
		await this.repository.init({forceInit: true, waitForClone: true});
		const headCommit = await this.repository.checkoutBranch(this.gitBranch);
		if (this.gitCommitSha) {
			await this.repository.checkoutCommit(this.gitCommitSha);
		} else {
			this.gitCommitSha = headCommit;
		}
		const testPaths = await this.repository.collectTestFilesPaths();
		this.tests = testPaths.filePaths.map(filePath => new TestCase({
			basePath: testPaths.basePath,
			testFilePath: filePath
		}));
		await this.collectTests();
	}

	collectTests() {
		return Promise.all(this.tests.map(testCase => testCase.fetchTestContent()));
	}

	getTestCaseByFilePath(testFilePath) {
		return this.tests.find(testCase => testCase.testFilePath === testFilePath);
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

let initialized = false;
const testSuites = new Set();

async function fetchTestSuites() {
	const coll = await dbConnector.getCollection(TEST_SUITE_COLL_NAME);
	const cursor = await coll.find();
	const itemsCount = await cursor.count();
	let itemsList = [];
	if (itemsCount > 0){
		itemsList = await cursor.toArray();
	}
	itemsList.forEach(testSuite => {
		testSuites.add(new TestSuite(Object.assign(testSuite, {repoProps: testSuite.repository})));
	});
}

async function getTestSuites() {
	if (!initialized) {
		await fetchTestSuites();
	}
	return Array.from(testSuites.values());
}

async function initTestSuiteRepositories() {
	const testSuites = await getTestSuites();
	await Promise.all(testSuites.map(async testSuite => testSuite.repository.init({waitForClone: true})));
	initialized = true;
}

async function updateTestSuite(testSuite) {
	const coll = await dbConnector.getCollection(TEST_SUITE_COLL_NAME);
	const filter = {_id: testSuite._id};
	const cursor = await coll.find(filter);
	const itemsCount = await cursor.count();
	if (itemsCount === 0) {
		throw new Error(`No test suite found with id ${testUuid}`);
	}
	return coll.updateOne(filter, {$set: testSuite});
}

module.exports = {
	TestSuite,
	TestCase,
	getTestSuites,
	updateTestSuite,
	initTestSuiteRepositories
};
