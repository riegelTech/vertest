'use strict';

import MainLayout from '../../layouts/main.vue';

const TEST_SUITE_PATH = '/api/test-suites/';

export default {
	components: {
		MainLayout
	},
	data() {
		return {
			testCase: {
				_userUuid: '',
				_testFilePath: '',
				_content: '',
				_status: 0
			}
		}
	},
	async mounted() {
		const testSuiteId = this.$route.params.testSuiteId;
		const testCaseId = decodeURIComponent(this.$route.params.testCaseId);
		try {
			const response = await this.$http.get(`${TEST_SUITE_PATH}${testSuiteId}`);
			if (response.status === 200) {
				const testSuite = response.body;
				const testCase =  testSuite.tests.find(testCase => testCase._testFilePath === testCaseId);
				if (testCase) {
					this.testCase = testCase;
				}

			}
		} catch (resp) {
			window.location.href = '/';
		}
	}
};
