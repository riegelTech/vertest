'use strict';

const statusesModule = require('../../testSuites/testCaseStatuses');
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
					testCase.status = defaultStatuses.getStatusByIndex(testCase.status);
				}
				newTestCases.push(new testSuiteModule.TestCase(testCase));
			}
			testSuite.tests = newTestCases;
			const newTestSuite = new testSuiteModule.TestSuite(testSuite);
			await testSuiteModule.updateTestSuite(newTestSuite);
		}
	}
};