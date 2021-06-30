'use strict';

const express = require('express');
const router = express.Router();

const statusesModule = require('./testCaseStatuses');
const testSuiteModule = require('../testSuites/testSuite');

const utils = require('../utils');
const logsModule = require('../logsModule/logsModule');
const logs = logsModule.getDefaultLoggerSync();

async function getTestCaseStatuses(req, res) {
	res.send(statusesModule.getStatuses())
}

async function getTestCasesStatusesInconsistencies(req, res) {
	const statusProblems = statusesModule.reviewExistingStatuses(await testSuiteModule.getTestSuites());
	res.send(statusProblems);
}


async function remediateTestCasesStatusesInconsistencies(req, res) {
	const testSuitesToUpdate = new Set();
	const remediations = req.body;

	try {
		for (let statusName in remediations) {
			if (remediations.hasOwnProperty(statusName)) {
				const testSuites = await testSuiteModule.getTestSuites();
				testSuites.forEach(testSuite => {
					testSuite.tests.forEach(testCase => {
						if (testCase.status.name === statusName) {
							testCase.setStatus(new statusesModule.Status(remediations[statusName]));
							testSuite.updateProgress();
							testSuitesToUpdate.add(testSuite);
						}
					});
				});
			}
		}

		if (testSuitesToUpdate.size > 0) {
			await Promise.all(Array.from(testSuitesToUpdate.values()).map(async testSuite => {
				await testSuiteModule.updateTestSuite(testSuite);
			}));
		}

		return res.status(200).send('ok');
	} catch (e) {
		logs.error(e.message);
		res.status(utils.getHttpCode(e.code));
		res.send({
			success: false,
			msg: e.message
		});
	}
}

router.get('/', getTestCaseStatuses)
	.get('/inconsistencies', getTestCasesStatusesInconsistencies)
	.post('/inconsistencies', remediateTestCasesStatusesInconsistencies);

module.exports = router;