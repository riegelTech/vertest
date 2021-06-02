'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const appConfigModule = require('../appConfig/config');
const logsModule = require('../logsModule/logsModule');
const logs = logsModule.getDefaultLoggerSync();
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
		logs.error(e.message);
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
		logs.error(e.message);
		res.send({
			success: false,
			msg: e.message
		});
	}
}

async function getTestSuiteHistory(req, res) {
	try {
		const from = req.body.from;
		const number = req.body.number;
		const logs = await logsModule.readTestSuiteLogs(req.params.uuid, from, number);
		res.send(logs);
	} catch(e) {
		logs.error(e.message);
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
		logs.error(e.message);
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
		const curUser = usersModule.getCurrentUser();

		const effectiveCurrentCommit = await repository.getCurrentCommit(testSuite.gitBranch);
		if (effectiveCurrentCommit.sha() !== currentCommit) {
			throw new Error(`Validations are based on start commit ${currentCommit} but current repository commit is ${effectiveCurrentCommit.sha()}`);
		}

		const {addedPatches, deletedPatches, modifiedPatches, renamedPatches} = await repository.getRepositoryDiff(testSuite, targetCommit);

		const modificationsToLog = [];
		modifiedPatches.forEach(async patch => {
			const test = testSuite.getTestCaseByFilePath(patch.file);
			if (newStatuses[test.testFilePath] && newStatuses[test.testFilePath] != test.status) {
				modificationsToLog.push({
					message: `Test file "${test.testFilePath}" status changed from "${TestCase.STATUS_HR(test.status)}" to "${TestCase.STATUS_HR(newStatuses[test.testFilePath])}"`
				});
			}
			const newStatus = newStatuses[test.testFilePath] || test.status;
			if (newStatus === null) {
				return;
			}
			test.status = newStatus;
		});

		addedPatches.forEach(patch => {
			testSuite.addTestCase(repository._repoDir, patch.file);
			modificationsToLog.push({
				message: `Add test case file "${patch.file}" to "${testSuite.name}" due to git update`,
				testFilePath: patch.file
			});
		});

		deletedPatches.forEach(patch => {
			testSuite.removeTestCase(patch.file);
			modificationsToLog.push({
				message: `Remove test case "${patch.file}" from "${testSuite.name}" due to git update`,
				testFilePath: patch.file
			});
		});

		renamedPatches.forEach(patch => {
			const test = testSuite.getTestCaseByFilePath(patch.file);
			test.testFilePath = patch.newFile;
			modificationsToLog.push({
				message: `Rename test case into "${testSuite.name}" due to git update, from "${patch.file}" to "${patch.newFile}"`,
				testFilePath: patch.file
			});
			modificationsToLog.push({
				message: `Rename test case into "${testSuite.name}" due to git update, from "${patch.file}" to "${patch.newFile}"`,
				testFilePath: patch.newFile // add another log line to retrieve the renaming action with both file names
			});
		});

		if (targetBranch) {
			await repository.checkoutBranch(targetBranch, targetCommit);
			const oldBranch = testSuite.gitBranch;
			testSuite.gitBranch = targetBranch;
			modificationsToLog.push({
				message: `Change branch for ${testSuite.name}, from ${oldBranch} to ${targetBranch}`
			});
		}
		await repository.checkoutCommit(targetCommit);
		modificationsToLog.push({
			message: `Change HEAD commit for ${testSuite.name}, to ${targetCommit}`
		});

		testSuite.status = TestSuite.STATUSES.UP_TO_DATE;
		testSuite.gitCommitSha = targetCommit;
		await Promise.all(testSuite.tests.map(test => test.fetchTestContent()));

		await testSuiteModule.updateTestSuite(testSuite);

		modificationsToLog.forEach(async auditLog => {
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, auditLog.message, auditLog.testFilePath);
		});

 		res.send(testSuite);
	} catch(e) {
		logs.error(e.message);
		res.send({
			success: false,
			msg: e.message
		});
	}
}

async function createTestSuite(req, res) {
	const appConfig = await appConfigModule.getAppConfig();
	try {
		const curUser = usersModule.getCurrentUser();
		const repository = repoModule.getTempRepository(req.body.repositoryUuid);
		await repository.moveRepository(appConfig.workspace.repositoriesDir);
		const testSuite = new TestSuite({name: req.body.testSuiteName, testDirs: req.body.filePatterns, repository});
		await testSuite.init();
		await testSuiteModule.addTestSuite(testSuite);
		await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test suite ${testSuite.name} ${testSuite._id} successfully created`);
		res.send({
			success: true,
			data: testSuite
		});
	} catch(e) {
		logs.error(e.message);
		res.send({
			success: false,
			msg: e.message
		})
	}
}

async function deleteTestSuite(req, res) {
	const testUuid = req.params.uuid;
	try {
		const curUser = usersModule.getCurrentUser();
		const testSuiteToDelete = testSuiteModule.getTestSuiteByUuid(testUuid);
		await testSuiteModule.removeTestSuite(testSuiteToDelete);
		await logsModule.auditLogForTestSuite(testUuid, curUser, `Test suite ${testSuiteToDelete.name} ${testSuiteToDelete._id} successfully deleted`);
		res.send({
			success: true,
			data: testSuiteToDelete
		});
	} catch (e) {
		logs.error(e.message);
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
		const err =  new Error(`User "${curUser.login}" (${curUser._id}) is readonly`);
		err.code =  RESPONSE_HTTP_CODES.LOCKED;
		throw err;
	}
}

async function affectUser(req, res) {
	try {
		assertUserIsNotReadOnly();
	} catch (e) {
		logs.error(e.message);
		res.status(utils.getHttpCode(e.code));
		return res.send({
			success: false,
			msg: e.message
		});
	}
	const curUser = usersModule.getCurrentUser();
	const userId = req.body.userId;

	let testSuite;
	let testCase;
	try {
		const entities = getTestFromUrlParam(req);
		testSuite = entities.testSuite;
		testCase = entities.testCase;
	} catch (e) {
		logs.error(e.message);
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
		if (testCase.user) {
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case "${testCase.testFilePath}" successfully affected to user "${testCase.user.login}"`, testCase.testFilePath);
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case status automatically switched to "${TestCase.STATUS_HR(TestCase.STATUSES.IN_PROGRESS)}"`, testCase.testFilePath);
		} else {
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case "${testCase.testFilePath}" successfully unaffected`, testCase.testFilePath);
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case status automatically switched to "${TestCase.STATUS_HR(TestCase.STATUSES.TODO)}"`, testCase.testFilePath);
		}
	} catch (e) {
		logs.error(e.message);
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
		logs.error(e.message);
		res.status(utils.getHttpCode(e.code));
		return res.send({
			success: false,
			msg: e.message
		});
	}

	const curUser = usersModule.getCurrentUser();
	let newTestStatus;
	switch (req.body.newStatus) {
		case TestCase.STATUSES.SUCCESS:
			newTestStatus = TestCase.STATUSES.SUCCESS;
			break;
		case TestCase.STATUSES.FAILED:
			newTestStatus = TestCase.STATUSES.FAILED;
			break;
		case TestCase.STATUSES.BLOCKED:
			newTestStatus = TestCase.STATUSES.BLOCKED;
			break;
		case TestCase.STATUSES.TODO:
			newTestStatus = TestCase.STATUSES.TODO;
			break;
		default:
			newTestStatus = TestCase.STATUSES.IN_PROGRESS;
	}

	let testSuite;
	let testCase;
	try {
		const entities = getTestFromUrlParam(req);
		testSuite = entities.testSuite;
		testCase = entities.testCase;
	} catch (e) {
		logs.error(e.message);
		return res.status(utils.RESPONSE_HTTP_CODES.ENOTFOUND).send(e.message);
	}

	if (testCase.user._id !== curUser._id) {
		const errMessage = `User "${curUser.firstName} ${curUser.lastName}" is not allowed to change ${testCase.testFilePath} status`;
		logs.error(errMessage);
		return res.status(utils.RESPONSE_HTTP_CODES.LOCKED)
			.send(errMessage);
	}
	const oldStatus = TestCase.STATUS_HR(testCase.status);
	const newStatus = TestCase.STATUS_HR(newTestStatus);
	try {
		testCase.setStatus(newTestStatus);
		if (testCase.status === TestCase.STATUSES.TODO) {
			testCase.user = null;
		}

		await testSuiteModule.updateTestSuite(testSuite);
		await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case "${testCase.testFilePath}" status successfully changed from "${oldStatus}" to "${newStatus}"`, testCase.testFilePath);
		if (testCase.user === null) {
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case "${testCase.testFilePath}" successfully unaffected`, testCase.testFilePath);
		}
		return res.status(200).send('ok');
	} catch(e) {
		logs.error(e.message);
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
	.post('/:uuid/history', getTestSuiteHistory)
	.post('/', createTestSuite)
	.put('/:uuid/solve', solveTestSuiteDiff)
	.delete('/:uuid', deleteTestSuite)
	// start test case API
	.get('/:uuid/test-case/:testCasePath', getTestCase)
	.post('/:uuid/test-case/:testCasePath/attach-user/', affectUser)
	.put('/:uuid/test-case/:testCasePath/set-status/', updateTestStatus);


module.exports = router;
