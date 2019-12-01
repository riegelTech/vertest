'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const dbConnector = require('../db/db-connector');
const usersModule = require('../users/users');

async function fetchTestCase(testSuiteId, testCasePath) {
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.TEST_SUITES);

	const filter = {_id: testSuiteId};
	const cursor = await coll.find(filter);
	const itemsCount = await cursor.count();
	if (itemsCount === 0) {
		throw new Error(`No test suite found with id ${testSuiteId}`);
	}
	const testSuite = (await cursor.toArray())[0];
	const testCase = testSuite.tests.find(testCase => testCase._testFilePath === testCasePath);
	if (!testCase) {
		throw new Error(`No test case found with id ${testCasePath}`);
	}

	return {testSuite, testCase};
}

async function getTestCase(req, res) {
	try {
		const {testCase} = await fetchTestCase(req.testSuiteUuid, decodeURIComponent(req.params.testCasePath));
		res.send(testCase);
	} catch(e) {
		res.send({
			success: false,
			msg: e.message
		});
	}
}

async function affectUser(req, res) {
	const userId = req.body.userId;

	try {
		const user = await usersModule.getUser(userId);
		const {testSuite, testCase} = await fetchTestCase(req.testSuiteUuid, decodeURIComponent(req.params.testCasePath));
		testCase._user = _.omit(user, ['password']);

		const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.TEST_SUITES);
		await coll.updateOne({_id: testSuite._id}, {$set: testSuite});
		return res.send({
			success: true
		});
	} catch(e) {
		res.send({
			success: false,
			msg: e.message
		});
	}
}

router.get('/:testCasePath', getTestCase)
	.post('/:testCasePath/attach-user/', affectUser);


module.exports = router;