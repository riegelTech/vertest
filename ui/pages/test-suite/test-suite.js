'use strict';

import Path from 'path';

import MainLayout from '../../layouts/main.vue';
import TestCasesTree from '../../components/testCasesTree.vue';

const TEST_SUITE_PATH = '/api/test-suites/';

export default {
	components: {
		MainLayout,
		TestCasesTree
	},
	data() {
		return {
			testSuite: {
				name: '',
				repoAddress: '',
				gitBranch: '',
				tests: [],
				testsTree: {}
			}
		}
	},
	async mounted() {
		const testSuiteId = this.$route.params.testSuiteId;
		try {
			const response = await this.$http.get(`${TEST_SUITE_PATH}${testSuiteId}`);
			if (response.status === 200) {
				this.testSuite = response.body;
				this.testSuite.tests.forEach(testCase => Object.assign(testCase, {_shortenTestFilePath: testCase.testFilePath.replace(this.testSuite.baseDir, '')}));
				this.createTestsTree();
			}
		} catch (resp) {
			window.location.href = '/';
		}
	},
	methods: {
		createTestsTree() {
			const testsPaths = this.testSuite.tests.map(test => ({
				splitPath: test._shortenTestFilePath.split(Path.sep).slice(1),
				fullPath: test.testFilePath,
				testCase: test
			}));

			function buildTree(testsPaths) {
				const tree = [];
				for (let testPath of testsPaths) {
					if (!testPath.splitPath[0]) {
						continue;
					}
					const dir = testPath.splitPath[0];
					if (!tree.find(existingDir => existingDir.name === dir)) {
						const sameDirs = testsPaths.filter(testPath => testPath.splitPath[0] === dir);
						tree.push({
							name: dir,
							path: testPath.splitPath.length > 1 ? '' : testPath.fullPath,
							testCase: testPath.testCase,
							children: buildTree(sameDirs.map(sameDir => ({
								splitPath: sameDir.splitPath.slice(1),
								fullPath: sameDir.fullPath,
								testCase: sameDir.testCase
							})))
						});
					}
				}
				return tree;
			}

			this.testSuite.testsTree = {name: 'root', children: buildTree(testsPaths)};
		}
	}
};
