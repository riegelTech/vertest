'use strict';

import MainLayout from '../../layouts/main.vue';
import TestCase from '../../components/test-case.vue';
import FileTree from '../../components/fileTree.vue';
import TestSuiteHistory from '../../components/testSuiteHistory.vue';
import {fileTreeUtils} from '../../components/fileTree.js';

const TEST_SUITE_PATH = '/api/test-suites/';

export default {
	components: {
		TestCase,
		MainLayout,
		FileTree,
		TestSuiteHistory
	},
	data() {
		return {
			testSuite: null,
			openedTestCase: null,
			testsTree: null
		}
	},
	async mounted() {
		return this.initTestSuite();
	},
	watch: {
		'$route.params.testCaseId': function (testCaseId) {
			this.openTest({path: decodeURIComponent(testCaseId)});
		}
	},
	methods: {
		async initTestSuite() {
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
					this.testsTree = fileTreeUtils.buildTree(filePaths, this.testSuite.repository._repoDir);
					this.testsTree = fileTreeUtils.leafTransformer(this.testsTree, leaf => {
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
		getTestCase(testCasePath) {
			return this.testSuite.tests.find(test => testCasePath === test.testFilePath);
		},
		openTest(testLink) {
			const test = this.getTestCase(testLink.path);
			if (test) {
				this.openedTestCase = test;
			}
		},
		updateTestCase() {
			return this.initTestSuite();
		}
	}
};
