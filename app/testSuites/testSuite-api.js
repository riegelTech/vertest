'use strict';

const express = require('express');
const router = express.Router();

const dbConnector = require('../db/db-connector');
const repoModule = require('../repositories/repositories');
const TestSuite = require('./testSuite');

const TEST_SUITE_COLL_NAME = 'testSuites';

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
				repositoryName = repoModule.getRepository(testSuite.repoAddress).name;
			} catch (e) {
				// do nothing : git repository does not exists but test suite remains
			}
			return Object.assign({repositoryName}, testSuite);
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
	const coll = await dbConnector.getCollection(TEST_SUITE_COLL_NAME);

	const testSuiteUuid = req.params.uuid;
	const filter = {_id: testSuiteUuid};
	try {
		const cursor = await coll.find(filter);
		const itemsCount = await cursor.count();
		if (itemsCount === 0) {
			throw new Error(`No test suite found with id ${testSuiteUuid}`);
		}
		const testSuite = (await cursor.toArray())[0];

		res.send(testSuite);
	} catch(e) {
		res.send({
			success: false,
			msg: e.message
		});
	}
}

async function createTestSuite(req, res) {
	const coll = await dbConnector.getCollection(TEST_SUITE_COLL_NAME);

	const {name, repoAddress, gitBranch} = req.body;

	let repository;
	try {
		repository = repoModule.getRepository(repoAddress);
	} catch (e) {
		res.status(404).send(e.message);
	}


	try {
		await repository.fetchRepository();
		await repository.checkoutBranch(gitBranch);
		const testsFilesPaths = await repository.collectTestFilesPaths();
		const testSuite = new TestSuite({name, repoAddress: repository.address, testsFilesPaths, gitBranch});
		await testSuite.collectTests();
		await coll.insertOne(testSuite);
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
	.post('/', createTestSuite)
	.delete('/:uuid', deleteTestSuite);


module.exports = router;
