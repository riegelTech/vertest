'use strict';

const express = require('express');
const router = express.Router();

const dbConnector = require('../db/db-connector');
const TEST_SUITE_COLL_NAME = 'testSuites';

async function getTestCase(req, res) {
	const coll = await dbConnector.getCollection(TEST_SUITE_COLL_NAME);

	const testSuiteUuid = req.testSuiteUuid;
	const testCasePath = decodeURIComponent(req.params.testCasePath);
	const filter = {_id: testSuiteUuid};
	try {
		const cursor = await coll.find(filter);
		const itemsCount = await cursor.count();
		if (itemsCount === 0) {
			throw new Error(`No test suite found with id ${testSuiteUuid}`);
		}
		const testSuite = (await cursor.toArray())[0];
		const testCase = testSuite.tests.find(testCase => testCase._testFilePath === testCasePath);
		if (!testCase) {
			throw new Error(`No test case found with id ${testCasePath}`);
		}

		res.send(testCase);
	} catch(e) {
		res.send({
			success: false,
			msg: e.message
		});
	}
}

async function updateTestCase(req, res) {

}

router.get('/:testCasePath', getTestCase)
	.put('/:testCasePath', updateTestCase);


module.exports = router;