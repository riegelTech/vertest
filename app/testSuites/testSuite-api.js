'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const appConfigModule = require('../appConfig/config');
const repoModule = require('../repositories/repositories');
const testSuiteModule = require('./testSuite');
const TestCase = testSuiteModule.TestCase;
const TestSuite = testSuiteModule.TestSuite;
const usersModule = require('../users/users');
const utils = require('../utils');


async function getTestSuites(req, res) {
	try {
		const testSuites = (await testSuiteModule.getTestSuites()).map(testSuite => Object.assign(testSuite, {
			repositoryAddress: testSuite.repository.address,
			gitBranch: testSuite.repository.gitBranch
		}));

		res.send(testSuites);
	} catch(e) {
		res.send({
			success: false,
			msg: e.message
		});
	}
}

async function getTestSuite(req, res) {
	try {
		const testSuite = testSuiteModule.getTestSuiteByUuid(req.params.uuid);
		res.send(testSuite);
	} catch(e) {
		res.send({
			success: false,
			msg: e.message
		});
	}
}

async function getTestSuiteDiff(req, res) {
	try {
		const testSuite = testSuiteModule.getTestSuiteByUuid(req.params.uuid);
		const repository = testSuite.repository;
		const mostRecentCommit = await repository.getRecentCommitOfBranch(req.body.branchName || repository.gitBranch);
		const repositoryDiff = await repository.getRepositoryDiff(testSuite, mostRecentCommit);
		res.send(repositoryDiff);
	} catch(e) {
		res.send({
			success: false,
			msg: e.message
		});
	}
}

async function solveTestSuiteDiff(req, res) {
	try {
		const testSuite = testSuiteModule.getTestSuiteByUuid(req.params.uuid);
		const repository = testSuite.repository;
		const {currentCommit, targetCommit, targetBranch, newStatuses} = req.body;

		const effectiveCurrentCommit = await repository.getCurrentCommit(testSuite.gitBranch);
		if (effectiveCurrentCommit.sha() !== currentCommit) {
			throw new Error(`Validations are based on start commit ${currentCommit} but current repository commit is ${effectiveCurrentCommit.sha()}`);
		}

		const {addedPatches, deletedPatches, modifiedPatches, renamedPatches} = await repository.getRepositoryDiff(testSuite, targetCommit);

		modifiedPatches.forEach(patch => {
			const test = testSuite.getTestCaseByFilePath(patch.file);
			const newStatus = newStatuses[test.testFilePath];
			if (newStatus === null) {
				return;
			}
			test.status = newStatus;
		});

		addedPatches.forEach(patch => {
			testSuite.addTestCase(repository._repoDir, patch.file);
		});

		deletedPatches.forEach(patch => {
			testSuite.removeTestCase(patch.file);
		});

		renamedPatches.forEach(patch => {
			const test = testSuite.getTestCaseByFilePath(patch.file);
			test.testFilePath = patch.newFile;
		});

		if (targetBranch) {
			await repository.checkoutBranch(targetBranch, targetCommit);
			testSuite.gitBranch = targetBranch;
		}
		await repository.checkoutCommit(targetCommit);

		testSuite.status = TestSuite.STATUSES.UP_TO_DATE;
		testSuite.gitCommitSha = targetCommit;
		await Promise.all(testSuite.tests.map(test => test.fetchTestContent()));

		await testSuiteModule.updateTestSuite(testSuite);

 		res.send(testSuite);
	} catch(e) {
		res.send({
			success: false,
			msg: e.message
		});
	}
}

async function createTestSuite(req, res) {
	const appConfig = await appConfigModule.getAppConfig();
	try {
		const repository = repoModule.getTempRepository(req.body.repositoryUuid);
		repository.testDirs = req.body.filePatterns;
		await repository.moveRepository(appConfig.workspace.repositoriesDir);
		const testSuite = new TestSuite({name: req.body.testSuiteName, repository});
		await testSuite.init();
		await testSuiteModule.addTestSuite(testSuite);
		res.send({
			success: true,
			data: testSuite
		});
	} catch(e) {
		res.send({
			success: false,
			msg: e.message
		})
	}
}

async function deleteTestSuite(req, res) {
	const testUuid = req.params.uuid;
	try {
		const testSuiteToDelete = testSuiteModule.getTestSuiteByUuid(testUuid);
		await testSuiteModule.removeTestSuite(testSuiteToDelete);

		res.send({
			success: true,
			data: testSuiteToDelete
		});
	} catch (e) {
		res.send({
			success: false,
			msg: e.message
		})
	}
}

function getTestFromUrlParam(req) {
	const testSuiteUuid = req.params.uuid;
	const testCasePath = decodeURIComponent(req.params.testCasePath);
	const testSuite = testSuiteModule.getTestSuiteByUuid(testSuiteUuid);
	const testCase = testSuite.tests.find(testCase => testCase.testFilePath === testCasePath);
	if (!testCase) {
		throw new Error(`Test case not found for path ${testCasePath}`);
	}
	return {
		testSuite,
		testCase
	}
}

function getTestCase(req, res) {
	try {
		const {testCase} = getTestFromUrlParam(req);
		res.status(200).send(testCase);
	} catch (e) {
		res.status(utils.RESPONSE_HTTP_CODES.ENOTFOUND).send(e.message);
	}
}

function assertUserIsNotReadOnly() {
	const curUser = usersModule.getCurrentUser();
	if (curUser.readOnly) {
		const err =  new Error(`User ${curUser._id} is readonly`);
		err.code =  RESPONSE_HTTP_CODES.LOCKED;
		throw err;
	}
	return;
}

async function affectUser(req, res) {
	try {
		assertUserIsNotReadOnly();
	} catch (e) {
		res.status(utils.getHttpCode(e.code));
		return res.send({
			success: false,
			msg: e.message
		});
	}

	const userId = req.body.userId;

	let testSuite;
	let testCase;
	try {
		const entities = getTestFromUrlParam(req);
		testSuite = entities.testSuite;
		testCase = entities.testCase;
	} catch (e) {
		res.status(utils.RESPONSE_HTTP_CODES.ENOTFOUND).send(e.message);
	}

	if (req.body.userId !== null) {
		const user = await usersModule.getUser(userId);
		testCase.user = _.omit(user, ['password']);
		testCase.setStatus(TestCase.STATUSES.IN_PROGRESS);
	} else {
		testCase.user = null;
		testCase.setStatus(TestCase.STATUSES.TODO);
	}

	try {
		await testSuiteModule.updateTestSuite(testSuite);
	} catch (e) {
		res.status(utils.RESPONSE_HTTP_CODES.DEFAULT);
	}

	return res.send({
		success: true
	});
}

async function updateTestStatus(req, res) {
	try {
		assertUserIsNotReadOnly();
	} catch (e) {
		res.status(utils.getHttpCode(e.code));
		return res.send({
			success: false,
			msg: e.message
		});
	}

	const curUser = usersModule.getCurrentUser();
	let testStatus;
	switch (req.body.newStatus) {
		case TestCase.STATUSES.SUCCESS:
			testStatus = TestCase.STATUSES.SUCCESS;
			break;
		case TestCase.STATUSES.FAILED:
			testStatus = TestCase.STATUSES.FAILED;
			break;
		case TestCase.STATUSES.BLOCKED:
			testStatus = TestCase.STATUSES.BLOCKED;
			break;
		case TestCase.STATUSES.TODO:
			testStatus = TestCase.STATUSES.TODO;
			break;
		default:
			testStatus = TestCase.STATUSES.IN_PROGRESS;
	}

	let testSuite;
	let testCase;
	try {
		const entities = getTestFromUrlParam(req);
		testSuite = entities.testSuite;
		testCase = entities.testCase;
	} catch (e) {
		return res.status(utils.RESPONSE_HTTP_CODES.ENOTFOUND).send(e.message);
	}

	if (testCase.user._id !== curUser._id) {
		return res.status(utils.RESPONSE_HTTP_CODES.LOCKED)
			.send(`User "${curUser.firstName} ${curUser.lastName}" is not allowed to change ${testCase.testFilePath} status`);
	}
	try {
		testCase.setStatus(testStatus);
		if (testCase.status === TestCase.STATUSES.TODO) {
			testCase.user = null;
		}

		await testSuiteModule.updateTestSuite(testSuite);
		return res.status(200).send('ok');
	} catch(e) {
		res.status(utils.getHttpCode(e.code));
		res.send({
			success: false,
			msg: e.message
		});
	}
}


router.get('/', getTestSuites)
	.get('/:uuid', getTestSuite)
	.post('/:uuid/diff', getTestSuiteDiff)
	.post('/', createTestSuite)
	.put('/:uuid/solve', solveTestSuiteDiff)
	.delete('/:uuid', deleteTestSuite)
	// start test case API
	.get('/:uuid/test-case/:testCasePath', getTestCase)
	.post('/:uuid/test-case/:testCasePath/attach-user/', affectUser)
	.put('/:uuid/test-case/:testCasePath/set-status/', updateTestStatus);


module.exports = router;
