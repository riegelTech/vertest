'use strict';

import MainLayout from '../../layouts/main.vue';

const TEST_SUITE_PATH = '/api/test-suites/';

export default {
	components: {
		MainLayout
	},
	data() {
		return {
			testSuite: {
				name: '',
				repoAddress: '',
				gitBranch: '',
				tests: []
			}
		}
	},
	async mounted() {
		const testSuiteId = this.$route.params.testSuiteId;
		try {
			const response = await this.$http.get(`${TEST_SUITE_PATH}${testSuiteId}`);
			if (response.status === 200) {
				this.testSuite = response.body;
				this.testSuite.tests.forEach(testCase => Object.assign(testCase, {_shortenTestFilePath: testCase._testFilePath.replace(this.testSuite.baseDir, '')}));
			}
		} catch (resp) {
			window.location.href = '/';
		}
	}
};
