'use strict';

const statusesModule = require('../../testCase/testCaseStatuses');
const testSuiteModule = require('../../testSuites/testSuite');

module.exports = {
	migrateExistingStatuses: async function () {
		const testSuites = await testSuiteModule.fetchRawTestSuites();
		statusesModule.loadDefaultStatuses();
		const defaultStatuses = statusesModule.getStatuses();
		for (let testSuite of testSuites) {
			const newTestCases = [];
			for (let testCase of testSuite.tests) {
				if (typeof testCase.status === 'number') {
					const convertedStatusIndex = testCase.status <= 1 ? testCase.status : testCase.status - 1;
					testCase.status = defaultStatuses.getStatusByIndex(convertedStatusIndex);
				}
				newTestCases.push(new testSuiteModule.TestCase(testCase));
			}
			testSuite.tests = newTestCases;
			const newTestSuite = new testSuiteModule.TestSuite(testSuite);
			await testSuiteModule.updateTestSuite(newTestSuite);
		}
	}
};