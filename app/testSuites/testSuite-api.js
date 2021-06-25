'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const testCaseApi = require('../testCase/testCase-api');

const appConfigModule = require('../appConfig/config');
const logsModule = require('../logsModule/logsModule');
const logs = logsModule.getDefaultLoggerSync();
const repoModule = require('../repositories/repositories');
const testSuiteModule = require('./testSuite');
const TestSuite = testSuiteModule.TestSuite;
const statusModule = require('../testCase/testCaseStatuses');
const usersModule = require('../users/users');


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

async function getTestSuiteRepositoryGitLog(req, res) {
	try {
		const testSuite = testSuiteModule.getTestSuiteByUuid(req.params.uuid);
		const parentsCommit = await testSuite.repository.getGitLog(req.params.limit);
		parentsCommit.forEach((rawCommit, index) => {
			parentsCommit[index] = repoModule.Repository.getfullCommit(rawCommit);
		});
		res.send(parentsCommit);
	} catch(e) {
		logs.error(e.message);
		res.send({
			success: false,
			msg: e.message
		});
	}
}

async function getAllRepositoryFiles(req, res) {
	try {
		const testSuite = testSuiteModule.getTestSuiteByUuid(req.params.uuid);
		const repository = testSuite.repository;
		const files = await repository.collectTestFilesPaths([repoModule.Repository.CATCH_ALL_FILES_PATTERN]);
		res.send(files);
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
		if (req.body.testDirs) {
			const repositoryDiff = await repository.getRepositoryFilesDiff(testSuite, req.body.testDirs);
			return res.send(repositoryDiff);
		}
		const mostRecentCommit = await repository.getRecentCommitOfBranch(req.body.branchName || repository.gitBranch);
		const repositoryDiff = await repository.getRepositoryDiff(testSuite, mostRecentCommit);
		return res.send(repositoryDiff);

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
		const {currentCommit, targetCommit, targetBranch, newStatuses, testDirs} = req.body;
		const curUser = usersModule.getCurrentUser();

		const effectiveCurrentCommit = await repository.getCurrentCommit(testSuite.gitBranch);
		if (effectiveCurrentCommit.sha() !== currentCommit) {
			throw new Error(`Validations are based on start commit ${currentCommit} but current repository commit is ${effectiveCurrentCommit.sha()}`);
		}
		if (testDirs && !Array.isArray(testDirs)) {
			throw new Error(`Unexpected testDirs type, Array expected, got ${typeof testDirs}`);
		}

		const modificationsToLog = [];

		let addedPatches, deletedPatches, modifiedPatches, renamedPatches;
		if (testDirs) {
			const diff = await repository.getRepositoryFilesDiff(testSuite, testDirs);
			addedPatches = diff.addedPatches;
			deletedPatches = diff.deletedPatches;
			modifiedPatches = diff.modifiedPatches;
			renamedPatches = diff.renamedPatches;
			const oldTestDir = testSuite.testDirs;
			testSuite.testDirs = testDirs;
			modificationsToLog.push({
				message: `Change file selector for "${testSuite.name}", from "${oldTestDir.join(', ')}", to "${testDirs.join(', ')}"`
			});
			await testSuite.init();
		}
		if (targetCommit) {
			const diff = await repository.getRepositoryDiff(testSuite, targetCommit, false);
			addedPatches = diff.addedPatches;
			deletedPatches = diff.deletedPatches;
			modifiedPatches = diff.modifiedPatches;
			renamedPatches = diff.renamedPatches;
		}

		const repositoryUpdated = targetCommit !== currentCommit;

		modifiedPatches.forEach(async patch => {
			const test = testSuite.getTestCaseByFilePath(patch.file) || testSuite.getTestCaseByFilePath(patch.newFile);
			if (!testSuite.getTestCaseByFilePath(patch.newFile)) {
				test.testFilePath = patch.newFile;
			}
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
			const test = testSuite.getTestCaseByFilePath(patch.file) || testSuite.getTestCaseByFilePath(patch.newFile);
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


		_.forEach(newStatuses, (newStatus, filePath) => {
			const testCase = testSuite.getTestCaseByFilePath(filePath);
			if (testCase && testCase.status.name !== newStatus.name) {
				const newStatus = statusModule.getStatuses().getStatusByName(newStatuses[testCase.testFilePath].name);
				if (newStatus) {
					modificationsToLog.push({
						message: `Test file "${testCase.testFilePath}" status changed from "${testCase.status.name}" to "${newStatus.name}"`
					});
					testCase.setStatus(newStatus, curUser);
				}
			}
		});

		if (targetBranch) {
			const oldBranch = testSuite.gitBranch;
			await testSuite.repository.checkoutBranch(targetBranch);
			testSuite.gitBranch = targetBranch;
			testSuite.gitCommitSha = targetCommit;
			modificationsToLog.push({
				message: `Change branch for "${testSuite.name}", from "${oldBranch}" to "${targetBranch}"`
			});
		}
		if (targetCommit) {
			await repository.checkoutCommit(targetCommit);
			testSuite.gitCommitSha = targetCommit;

			modificationsToLog.push({
				message: `Change HEAD commit for "${testSuite.name}", from "${testSuite.name}", to "${targetCommit}"`
			});
		}
		if (repositoryUpdated) {
			testSuite.status = TestSuite.STATUSES.UP_TO_DATE;
		}

		await testSuite.collectTests();

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

router.get('/', getTestSuites)
	.get('/:uuid', getTestSuite)
	.get('/:uuid/repository/all-files', getAllRepositoryFiles)
	.get('/:uuid/gitLog/:limit', getTestSuiteRepositoryGitLog)
	.post('/:uuid/diff', getTestSuiteDiff)
	.post('/:uuid/history', getTestSuiteHistory)
	.post('/', createTestSuite)
	.put('/:uuid/solve', solveTestSuiteDiff)
	.delete('/:uuid', deleteTestSuite);

router.use('/:uuid/test-case', function(req, res, next) {
	req.testSuiteUuid = req.params.uuid;
	next()
}, testCaseApi);


module.exports = router;
