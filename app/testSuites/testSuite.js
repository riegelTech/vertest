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
const testCaseStatuses = require('../testCase/testCaseStatuses');
const Status = testCaseStatuses.Status;
const utils = require('../utils');
const logsModule = require('../logsModule/logsModule');
const defaultLogger = logsModule.getDefaultLoggerSync();

const INCLUDE_RE = /!{3}\s*include(.+?)!{3}/gi;
const BRACES_RE = /\((.+?)\)/i;

class TestCase extends EventEmitter {
	constructor({testFilePath = '', basePath = '', content= '', status = testCaseStatuses.getStatuses().getStatusByIndex(0), user = null, linkedFilesByInclusion = []}) {
		super();
		this.basePath = basePath;
		this.testFilePath = testFilePath;
		this.content = content;
		this.setStatus(new Status(status));
		this.user = user;
		this.linkedFilesByInclusion = linkedFilesByInclusion;
	}

	async fetchTestContent() {
		const testFilePathFull = Path.resolve(this.basePath, this.testFilePath);
		this.content = await utils.readFile(testFilePathFull, 'utf8');

		const basePath = this.basePath;
		const testFilePath = this.testFilePath;

		async function getInclusionTree(fileContent, filePath, ancestors = []) {
			const absoluteFilePath = Path.resolve(basePath, filePath);
			ancestors.push(absoluteFilePath);
			const inclusions = [];
			let cap;
			while ((cap = INCLUDE_RE.exec(fileContent)) !== null) {
				let includePath = cap[1].trim();
				includePath = includePath.replace(BRACES_RE, '$1').trim();
				const includedFilePath = Path.join(Path.dirname(filePath), includePath);
				const absoluteIncludedFilePath = Path.join(basePath, Path.dirname(filePath), includePath);

				if (ancestors.find(ancestorPath => ancestorPath === absoluteIncludedFilePath)) {
					throw new Error(`Infinite recursion in markdown inclusions while parsing ${testFilePath} content`);
				}
				if (Path.relative(basePath, absoluteIncludedFilePath).startsWith('..')) {
					throw new Error(`A markdown file includes a document outside of the test scope`);
				}
				const contentBeforeCap = fileContent.slice(0, cap.index);
				inclusions.push({
					line: contentBeforeCap.split(/\r\n|\r|\n/).length,
					filePath: includedFilePath,
					mdMarker: cap[0]
				});
			}
			return {
				filePath,
				content: fileContent,
				inclusions: await Promise.all(inclusions.map(async inclusion => {
					const includedFileContent = await utils.readFile(Path.join(basePath, inclusion.filePath), 'utf8');
					return Object.assign({}, inclusion, await getInclusionTree(includedFileContent, inclusion.filePath, ancestors));
				}))
			};
		}

		const inclusionTree = await getInclusionTree(this.content, this.testFilePath);
		this.linkedFilesByInclusion = inclusionTree.inclusions.length ? inclusionTree.inclusions : [];
	}

	async getIncludedFilesFlat() {
		const res = [];
		await this.applyOnEachTreeItem(null, inclusion => {
			res.push(inclusion.filePath);
			return inclusion;
		});
		return res;
	}

	getInclusionsTreeSegment(tree, assertionFunc) {
		const treeCopy = tree ?
			Object.assign({}, tree) :
			Object.assign({}, {
				filePath: this.testFilePath,
				inclusions: this.linkedFilesByInclusion
			});

		function assertInTree(tree) {
			const inclusions = tree.inclusions.filter(inclusion => assertInTree(inclusion));
			if (!assertionFunc(tree) && inclusions.length === 0) {
				return null;
			}
			tree.inclusions = inclusions;
			return tree;
		}
		return assertInTree(treeCopy);
	}

	async applyOnEachTreeItem(tree, applyFunc, childKeyNameTarget = 'inclusions') {

		const treeCopy = tree ?
			Object.assign({}, tree) :
			Object.assign({}, {
				filePath: this.testFilePath,
				inclusions: this.linkedFilesByInclusion
			});

		async function applyInTree(treeItem) {
			treeItem[childKeyNameTarget] = await Promise.all(treeItem[childKeyNameTarget].map(async inclusion => await applyInTree(inclusion)));
			let segment = await applyFunc(treeItem);
			return segment;
		}

		return applyInTree(treeCopy);
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
		let newTests = testPaths.filePaths.map(filePath => {
			const existingTest = this.tests.find(existingTest => existingTest.testFilePath === filePath);
			return existingTest || new TestCase({
				basePath: testPaths.basePath,
				testFilePath: filePath
			});
		});
		this.tests = newTests;

		this.bindTestCasesStates();
		await this.collectTests();
	}

	async getInvolvedFiles() {
		let res = [].concat(this.testDirs);
		await Promise.all(this.tests.map(async testCase => {
			res = res.concat(await testCase.getIncludedFilesFlat());
		}));
		return _.uniq(res);
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
			status: testCaseStatuses.getStatuses().defaultStatus
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

async function initTestSuiteLoggers() {
	const testSuites = await getTestSuites();
	await Promise.all(testSuites.map(async testSuite => logsModule.getTestSuiteLogger(testSuite._id)));
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
		let testSuites;
		try {
			testSuites = await getTestSuites();
		} catch (e) {
			defaultLogger.error({message: e.message});
			return;
		}
		await Promise.all(testSuites.map(async testSuite => {
			if (testSuite.repository.authMethod === repoModule.Repository.authMethods.SSH && !testSuite.repository.sshKey.isDecrypted) {
				return;
			}
			const testSuiteLogger = await logsModule.getTestSuiteLogger(testSuite._id);
			try {
				await testSuite.repository.refreshAvailableGitBranches();

				const testDirs = await testSuite.getInvolvedFiles();
				const testFilesHasChanged = await testSuite.repository.lookupForChanges(testDirs)
					|| await testSuite.repository.lookupForChanges(testDirs, true);
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
	initTestSuiteLoggers,
	watchTestSuitesChanges
};
