'use strict';

const express = require('express');
const router = express.Router();

const appConfigModule = require('../appConfig/config');
const repoModule = require('../repositories/repositories');
const testCaseApi = require('./testCase-api');
const testSuiteModule = require('./testSuite');
const TestSuite = testSuiteModule.TestSuite;


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
		console.error(e);
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
		console.error(e);
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


router.get('/', getTestSuites)
	.get('/:uuid', getTestSuite)
	.post('/:uuid/diff', getTestSuiteDiff)
	.post('/', createTestSuite)
	.put('/:uuid/solve', solveTestSuiteDiff)
	.delete('/:uuid', deleteTestSuite)
	.use('/:uuid/test-case', function (req, res, next) {
		req.testSuiteUuid = req.params.uuid;
		next();
	})
	.use('/:uuid/test-case', testCaseApi);


module.exports = router;
