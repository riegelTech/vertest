'use strict';

const EventEmitter = require('events');
const Path = require('path');

const _ = require('lodash');
const fsExtra = require('fs-extra');
const {lowestCommonAncestor} = require('lowest-common-ancestor');
const uuid = require('uuidv4');

const appConfig = require('../appConfig/config');
const dbConnector = require('../db/db-connector');
const repoModule = require('../repositories/repositories');
const {sshKeyCollectionEventEmitter} = require('../sshKeys/ssh-keys');
const testCaseStatuses = require('./testCaseStatuses');
const Status = testCaseStatuses.Status;
const utils = require('../utils');
const logsModule = require('../logsModule/logsModule');
const defaultLogger = logsModule.getDefaultLoggerSync();

const INCLUDE_RE = /!{3}\s*include(.+?)!{3}/i;
const BRACES_RE = /\((.+?)\)/i;

class TestCase extends EventEmitter {
	constructor({testFilePath = '', basePath = '', content= '', status = testCaseStatuses.getStatuses().getStatusByIndex(0), user = null}) {
		super();
		this.basePath = basePath;
		this.testFilePath = testFilePath;
		this.content = content;
		this.setStatus(new Status(status));
		this.user = user;
		this.linkedFilesByInclusion = [];
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

	static STATUS_HR(statusNum) {
		return _.invert(TestCase.STATUSES)[statusNum];
	}

	async fetchTestContent() {
		const testFilePath = Path.resolve(this.basePath, this.testFilePath);
		this.content = await utils.readFile(testFilePath, 'utf8');

		async function getInclusionTree(fileContent, filePath) {
			const inclusionsResult = {
				filePath,
				content: fileContent,
				inclusions: []
			};
			if (!fileContent.match(INCLUDE_RE)) {
				return inclusionsResult;
			}
			let cap;
			while ((cap = INCLUDE_RE.exec(fileContent))) {
				let includePath = cap[1].trim();
				const sansBracesMatch = BRACES_RE.exec(includePath);
				includePath = sansBracesMatch[1].trim();
				const includedFilePath = Path.join(Path.dirname(filePath), includePath);
				const includedFileContent = await utils.readFile(includedFilePath, 'utf8');
				inclusionsResult.inclusions.push({
					start: cap.index,
					end: cap.index + cap[0].length,
					file: await getInclusionTree(includedFileContent, includedFilePath)
				});
				fileContent = fileContent.slice(0, cap.index) + includedFileContent + fileContent.slice(cap.index + cap[0].length, fileContent.length);
			}
			return inclusionsResult;
		}

		const inclusionTree = await getInclusionTree(this.content, testFilePath);
		this.linkedFilesByInclusion = inclusionTree.inclusions.length ? inclusionTree.inclusions : [];
	}

	get isFinished() {
		return this.status.testCaseIsDone;
	}

	setStatus(newStatus, user = null) {
		if (newStatus.constructor.name !== 'Status') {
			throw new Error(`New status must be a Status instance, "${newStatus.constructor.name}" given`);
		}
		this.status = newStatus;
		if (user && !this.status.isDefaultStatus) {
			this.user = user;
		}
		this.emit('statusUpdated', newStatus);
	}
}

class TestSuite {
	constructor({_id = uuid.uuid(), name = '', repository = null, testDirs = [], tests = [], status = TestSuite.STATUSES.UP_TO_DATE}) {
		this._id = _id;
		this.name = name;
		this.status = status;
		this.tests = tests.map(rawTestCase => new TestCase(rawTestCase));
		this.baseDir = lowestCommonAncestor(...this.tests.map(testCase => testCase.testFilePath));

		this.history = [];

		this.updateProgress();

		if (repository instanceof repoModule.Repository) {
			this.repository = repository;
		} else {
			this.repository = new repoModule.Repository(Object.assign(repository, {
				repoPath: repository._repoDir
			}));
		}

		this.testDirs = typeof testDirs === 'string' ? [testDirs] : testDirs;
		// Avoid first slash or dot - slash to start pattern
		this.testDirs = this.testDirs.map(testDirPattern => testDirPattern.replace(/^(\/|\.\/)/, ''));

		this.bindTestCasesStates();
	}

	async init() {
		const testPaths = await this.repository.collectTestFilesPaths(this.testDirs);
		this.tests = testPaths.filePaths.map(filePath => new TestCase({
			basePath: testPaths.basePath,
			testFilePath: filePath
		}));
		this.bindTestCasesStates();
		await this.collectTests();
	}

	bindTestCasesStates() {
		const statusUpdatedEvent = 'statusUpdated';
		this.tests.forEach(testCase => {
			testCase.removeAllListeners(statusUpdatedEvent);
			testCase.on(statusUpdatedEvent, () => this.updateProgress());
		});
	}

	collectTests() {
		return Promise.all(this.tests.map(testCase => testCase.fetchTestContent()));
	}

	getTestCaseByFilePath(testFilePath) {
		return this.tests.find(testCase => testCase.testFilePath === testFilePath);
	}

	addTestCase(basePath, testFilePath) {
		const testCase = new TestCase({
			testFilePath,
			basePath,
			status: TestCase.STATUSES.TODO
		});
		this.tests.push(testCase);
		testCase.on('statusUpdated', () => this.updateProgress());
		return testCase;
	}

	removeTestCase(testFilePath) {
		const testIndex = this.tests.findIndex(testCase => testCase.testFilePath === testFilePath);
		if (testIndex === undefined) {
			throw new Error(`Unable to find test with file path ${testFilePath}`);
		}
		const oldTestCase = this.tests[testIndex];
		oldTestCase.removeAllListeners('updatedStatus');
		this.tests.splice(testIndex, 1);
	}

	updateProgress() {
		const finished = this.tests.reduce((total, testCase) => {
			if (testCase.isFinished) {
				total ++;
			}
			return total;
		}, 0);
		const total = this.tests.length;
		const percent = total === 0 ? 0 : Math.round((finished / total) * 100 * 100) / 100;
		this.progress = {
			finished,
			total,
			percent
		};
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
const testSuites = new Map();

async function fetchRawTestSuites() {
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.TEST_SUITES);
	const cursor = await coll.find();
	const itemsCount = await cursor.count();
	if (itemsCount > 0){
		return cursor.toArray();
	}
	return [];
}

async function fetchTestSuites() {
	const rawTestSuites = await fetchRawTestSuites();
	rawTestSuites.forEach(testSuite => {
		const testSuiteInstance = new TestSuite(Object.assign(testSuite, {repository: testSuite.repository}));
		testSuites.set(testSuiteInstance._id, testSuiteInstance);
	});
	sshKeyCollectionEventEmitter.on('sshKeyDecrypted', setDecryptedKeyToRepository);
}

async function getTestSuites() {
	if (!initialized) {
		await fetchTestSuites();
	}
	return Array.from(testSuites.values());
}

function getTestSuiteByUuid(testSuiteUuid) {
	if (!testSuites.has(testSuiteUuid)) {
		const err = new Error(`No test suite found for UUID ${testSuiteUuid}`);
		err.code = 'ENOTFOUND';
		throw err;
	}
	return testSuites.get(testSuiteUuid);
}

async function initTestSuiteRepositories() {
	const testSuites = await getTestSuites();
	await Promise.all(testSuites.map(async testSuite => testSuite.repository.init({waitForClone: true})));
	initialized = true;
}

async function updateTestSuite(testSuite) {
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.TEST_SUITES);
	const filter = {_id: testSuite._id};
	const cursor = await coll.find(filter);
	const itemsCount = await cursor.count();
	if (itemsCount === 0) {
		throw new Error(`No test suite found with id ${testUuid}`);
	}
	await coll.updateOne(filter, {$set: testSuite});
	testSuites.set(testSuite._id, testSuite);
}

async function addTestSuite(testSuite){
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.TEST_SUITES);

	await coll.insertOne(testSuite);
	testSuites.set(testSuite._id, testSuite);
}

async function removeTestSuite(testSuite) {
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.TEST_SUITES);
	const filter = {_id: testSuite._id};
	const cursor = await coll.find(filter);
	const itemsCount = await cursor.count();
	if (itemsCount === 0) {
		throw new Error(`No test suite found with id ${testSuite._id}`);
	}
	await coll.deleteOne(filter);
	await testSuite.repository.remove();
	testSuites.delete(testSuite._id);
}

function setDecryptedKeyToRepository(sshKey) {
	testSuites.forEach(testSuite => {
		if (testSuite.repository.authMethod === repoModule.Repository.authMethods.SSH && testSuite.repository.sshKey.name === sshKey.name) {
			testSuite.repository.setSshKey(sshKey);
		}
	});
}

async function watchTestSuitesChanges() {
	const config = await appConfig.getAppConfig();
	const tempRepoDir = config.workspace.temporaryRepositoriesDir;
	const HOUR_MS = 60 * 60 * 1000;
	setInterval(async () => {
		const tempsRepositories = await utils.readDir(tempRepoDir);
		const unusedDirs = (await Promise.all(tempsRepositories
			.map(async dirEntry => {
				const dirPath = Path.join(tempRepoDir, dirEntry);
				return {
					stat: await utils.stat(dirPath),
					dirPath
				};
			})))
				.filter(({stat}) => stat.isDirectory() && Date.now() - stat.birthtimeMs > HOUR_MS);

		await Promise.all(unusedDirs.map(unusedDir => {
			return fsExtra.remove(unusedDir.dirPath);
		}));

		const testSuites = await getTestSuites();
		await Promise.all(testSuites.map(async testSuite => {
			if (testSuite.repository.authMethod === repoModule.Repository.authMethods.SSH && !testSuite.repository.sshKey.isDecrypted) {
				return;
			}
			const testSuiteLogger = await logsModule.getTestSuiteLogger(testSuite._id);
			try {
				await testSuite.repository.refreshAvailableGitBranches();
				const testFilesHasChanged = await testSuite.repository.lookupForChanges(testSuite.testDirs)
					|| await testSuite.repository.lookupForChanges(testSuite.testDirs, true);
				if (testFilesHasChanged && testSuite.status === TestSuite.STATUSES.UP_TO_DATE) {
					testSuiteLogger.log(`test-suite-${testSuite._id}` ,`Repository change detected for test suite ${testSuite.name}`);
					testSuite.status = TestSuite.STATUSES.TO_UPDATE;
					await updateTestSuite(testSuite);
				}
			} catch (e) {
				if (e.code === 'EDELETEDBRANCH') {
					testSuiteLogger.log(`test-suite-${testSuite._id}` ,`Git branch deleted, please change destination branch for test suite ${testSuite.name}`);
					testSuite.status = TestSuite.STATUSES.TO_TOGGLE_BRANCH;
					await updateTestSuite(testSuite);
					await testSuite.repository.refreshAvailableGitBranches();
					return;
				}
				defaultLogger.error({message: e.message});
			}
		}));
	}, 5000);
}

module.exports = {
	TestSuite,
	TestCase,
	// start test suite CRUD
	addTestSuite,
	getTestSuites,
	fetchRawTestSuites,
	getTestSuiteByUuid,
	updateTestSuite,
	removeTestSuite,
	// end test suite CRUD
	initTestSuiteRepositories,
	watchTestSuitesChanges
};
