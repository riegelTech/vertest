'use strict';

import MainLayout from '../../layouts/main.vue';
import FileTree from '../../components/fileTree.vue';

import {fileTreeUtils} from '../../components/fileTree.js';

const TEST_SUITE_PATH = '/api/test-suites/';

export default {
	components: {
		MainLayout,
		FileTree
	},
	data() {
		return {
			testSuite: null
		}
	},
	async mounted() {
		const testSuiteId = this.$route.params.testSuiteId;
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
						return Object.assign({}, leaf, {
							testCase: testFileMapping[leaf.fullPath]
						})
					}
				});
			}
		} catch (resp) {
			window.location.href = '/';
		}
	},
	methods: {

	}
};
