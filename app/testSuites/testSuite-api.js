'use strict';

const express = require('express');
const router = express.Router();

const dbConnector = require('../db/db-connector');
const repoModule = require('../repositories/repositories');
const testCaseApi = require('./testCase-api');
const {TestSuite} = require('./testSuite');

const TEST_SUITE_COLL_NAME = 'testSuites';

async function getTestSuiteByUuid(testSuiteId) {
	const coll = await dbConnector.getCollection(TEST_SUITE_COLL_NAME);
	const filter = {_id: testSuiteId};
	const cursor = await coll.find(filter);
	const itemsCount = await cursor.count();
	if (itemsCount === 0) {
		throw new Error(`No test suite found with id ${testSuiteId}`);
	}
	return new TestSuite((await cursor.toArray())[0]);
}

async function getTestSuites(req, res) {
	const coll = await dbConnector.getCollection(TEST_SUITE_COLL_NAME);
	try {
		const cursor = await coll.find();
		const itemsCount = await cursor.count();
		let itemsList = [];
		if (itemsCount > 0){
			itemsList = await cursor.toArray();
		}

		const testSuites = itemsList.map(testSuite => {
			let repositoryName = 'Unknown';
			try {
				repositoryName = repoModule.getTrackingRepository(testSuite.repoAddress).name;
			} catch (e) {
				// do nothing : git repository does not exists but test suite remains
			}
			return Object.assign({repositoryName}, new TestSuite(testSuite));
		});

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
		const testSuite = await getTestSuiteByUuid(req.params.uuid);
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
		const testSuite = await getTestSuiteByUuid(req.params.uuid);
		const repository = repoModule.getTrackingRepository(testSuite.repoAddress);
		const mostRecentCommit = await repository.getRecentCommitOfBranch(req.body.branchName || testSuite.gitBranch);
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
		const coll = await dbConnector.getCollection(TEST_SUITE_COLL_NAME);
		const testSuite = await getTestSuiteByUuid(req.params.uuid);
		const repository = repoModule.getTrackingRepository(testSuite.repoAddress);
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
		await coll.updateOne({_id: testSuite._id}, {$set: testSuite});

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
	const coll = await dbConnector.getCollection(TEST_SUITE_COLL_NAME);

	const {name, repoAddress, gitBranch} = req.body;

	try {
		const trackingRepository = await repoModule.getTrackingRepository(repoAddress); // TODO handle error cases in catch block
		const testSuite = new TestSuite({name, repoProps: trackingRepository, gitBranch});
		await testSuite.init();
		repoModule.addTestSuiteRepository(testSuite.repository);
		await coll.insertOne(testSuite);
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
	const coll = await dbConnector.getCollection(TEST_SUITE_COLL_NAME);
	const testUuid = req.params.uuid;
	try {
		const filter = {_id: testUuid};
		const cursor = await coll.find(filter);
		const itemsCount = await cursor.count();
		if (itemsCount === 0) {
			throw new Error(`No test suite found with id ${testUuid}`);
		}
		const oldTestSuite = (await cursor.toArray())[0];
		await coll.deleteOne(filter);
		res.send({
			success: true,
			data: new TestSuite(oldTestSuite)
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
