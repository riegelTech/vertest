'use strict';

import MainLayout from '../../layouts/main.vue';
import TestCase from '../../components/test-case.vue';
import FileTree from '../../components/fileTree.vue';
import {fileTreeUtils} from '../../components/fileTree.js';

const TEST_SUITE_PATH = '/api/test-suites/';

export default {
	components: {
		TestCase,
		MainLayout,
		FileTree
	},
	data() {
		return {
			testSuite: null,
			openedTestCase: null
		}
	},
	async mounted() {
		const testSuiteId = this.$route.params.testSuiteId;
		const testCaseId = this.$route.params.testCaseId;
		try {
			const response = await this.$http.get(`${TEST_SUITE_PATH}${testSuiteId}`);
			if (response.status === 200) {
				this.testSuite = response.body;
				const filePaths = this.testSuite.tests.map(testCase => testCase.testFilePath);

				const testFileMapping = {};
				this.testSuite.tests.forEach(testCase => {
					testFileMapping[testCase.testFilePath] = testCase;
				});
				this.testSuite.testsTree = fileTreeUtils.buildTree(filePaths, this.testSuite.repository._repoDir);
				this.testSuite.testsTree = fileTreeUtils.leafTransformer(this.testSuite.testsTree, leaf => {
					if (testFileMapping[leaf.fullPath]) {
						const testCase = testFileMapping[leaf.fullPath];
						return Object.assign({}, leaf, {
							status: testCase.status,
							link: `/test-suites/${this.testSuite._id}/test-case/${encodeURIComponent(encodeURIComponent(testCase.testFilePath))}`,
							user: testCase.user
						})
					}
				});
			}
			if (testCaseId) {
				this.openTest({path: testCaseId});
			}
		} catch (resp) {
			window.location.href = '/';
		}
	},
	watch: {
		'$route.params.testCaseId': function (testCaseId) {
			this.openTest({path: decodeURIComponent(testCaseId)});
		}
	},
	methods: {
		openTest(testLink) {
			const test = this.testSuite.tests.find(test => testLink.path === test.testFilePath);
			if (test) {
				this.openedTestCase = test;
			}
		}
	}
};
