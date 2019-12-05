'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const dbConnector = require('../db/db-connector');
const {TestSuite, TestCase} = require('./testSuite');
const usersModule = require('../users/users');
const {RESPONSE_HTTP_CODES, getHttpCode} = require('../utils');

async function fetchTestCase(testSuiteId, testCasePath) {
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.TEST_SUITES);

	const filter = {_id: testSuiteId};
	const cursor = await coll.find(filter);
	const itemsCount = await cursor.count();
	if (itemsCount === 0) {
		const errTestSuite = new Error(`No test suite found with id ${testSuiteId}`);
		errTestSuite.code = RESPONSE_HTTP_CODES.ETESTCASENOTFOUND;
		throw errTestSuite;
	}
	const testSuite = new TestSuite((await cursor.toArray())[0]);
	const testCase = testSuite.tests.find(testCase => {
		return testCase.testFilePath === testCasePath
	});
	if (!testCase) {
		const errTestCase = new Error(`No test case found with id ${testCasePath}`);
		errTestCase.code = RESPONSE_HTTP_CODES.ETESTCASENOTFOUND;
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
		res.status(getHttpCode(e.code));
		return res.send({
			success: false,
			msg: e.message
		});
	}

	const userId = req.body.userId;

	try {
		const {testSuite, testCase} = await fetchTestCase(req.testSuiteUuid, decodeURIComponent(req.params.testCasePath));
		if (req.body.userId !== null) {
			const user = await usersModule.getUser(userId);
			testCase.user = _.omit(user, ['password']);
			testCase.status = TestCase.STATUSES.IN_PROGRESS;
		} else {
			testCase.user = null;
			testCase.status = TestCase.STATUSES.TODO;
		}

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

async function updateTestStatus(req, res) {
	try {
		assertUserIsNotReadOnly();
	} catch (e) {
		res.status(getHttpCode(e.code));
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
		default:
			testStatus = TestCase.STATUSES.IN_PROGRESS;
	}


	try {
		const {testSuite, testCase} = await fetchTestCase(req.testSuiteUuid, decodeURIComponent(req.params.testCasePath));
		if (testCase.user._id !== curUser._id) {
			const err = new Error(`User "${curUser.firstName} ${curUser.lastName}" is not allowed to change ${testCase.testFilePath} status`);
			err.code = RESPONSE_HTTP_CODES.LOCKED;
		}

		testCase.status = testStatus;

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
	.post('/:testCasePath/attach-user/', affectUser)
	.put('/:testCasePath/set-status/', updateTestStatus);


module.exports = router;