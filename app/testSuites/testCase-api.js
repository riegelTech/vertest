'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const dbConnector = require('../db/db-connector');
const {TestSuite, TestCase} = require('./testSuite');
const usersModule = require('../users/users');
const {getHttpCode} = require('../utils');

async function fetchTestCase(testSuiteId, testCasePath) {
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.TEST_SUITES);

	const filter = {_id: testSuiteId};
	const cursor = await coll.find(filter);
	const itemsCount = await cursor.count();
	if (itemsCount === 0) {
		const errTestSuite = new Error(`No test suite found with id ${testSuiteId}`);
		errTestSuite.code = 'ETESTSUITENOTFOUND';
		throw errTestSuite;
	}
	const testSuite = new TestSuite((await cursor.toArray())[0]);
	const testCase = testSuite.tests.find(testCase => {
		return testCase.testFilePath === testCasePath
	});
	if (!testCase) {
		const errTestCase = new Error(`No test case found with id ${testCasePath}`);
		errTestCase.code = 'ETESTCASENOTFOUND';
		throw errTestCase;
	}

	return {testSuite, testCase};
}

async function getTestCase(req, res) {
	try {
		const {testCase} = await fetchTestCase(req.testSuiteUuid, decodeURIComponent(req.params.testCasePath));
		res.send(testCase);
	} catch(e) {
		res.status(getHttpCode(e.code));
		res.send({
			success: false,
			msg: e.message
		});
	}
}

async function affectUser(req, res) {
	const curUser = usersModule.getCurrentUser();
	if (curUser.readOnly) {
		res.status(getHttpCode('LOCKED'));
		return res.send({
			success: false,
			msg: `User ${curUser._id} is readonly`
		});
	}

	const userId = req.body.userId;

	try {
		const user = await usersModule.getUser(userId);
		const {testSuite, testCase} = await fetchTestCase(req.testSuiteUuid, decodeURIComponent(req.params.testCasePath));
		testCase.user = _.omit(user, ['password']);

		const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.TEST_SUITES);
		await coll.updateOne({_id: testSuite._id}, {$set: testSuite});
		return res.send({
			success: true
		});
	} catch(e) {
		res.status(getHttpCode(e.code));
		res.send({
			success: false,
			msg: e.message
		});
	}
}

router.get('/:testCasePath', getTestCase)
	.post('/:testCasePath/attach-user/', affectUser);


module.exports = router;