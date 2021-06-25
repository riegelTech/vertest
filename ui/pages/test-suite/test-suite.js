'use strict';

import {appConfigEventBus} from '../../components/appConfig';
import MainLayout from '../../layouts/main.vue';
import TestCase from '../../components/test-case.vue';
import FileTree from '../../components/fileTree.vue';
import TestSuiteHistory from '../../components/testSuiteHistory.vue';
import {fileTreeUtils} from '../../components/fileTree.js';
import BreadCrumb from '../../components/breadCrumb.vue';
import DiffViewer from '../../components/diffViewer.vue';
import TestCaseState from '../../components/testCaseState.vue';
import {breadCrumbEventBus} from '../../components/breadCrumb.vue';
import {D3PieChart} from 'vue-d3-charts';

import FilePatternForm from '../../components/filePatternForm.vue';
import {filePatternSignification} from '../../components/filePatternForm.vue';

const DEFAULT_TEST_SUITE_CHART_CONFIG = {
	key: false,
	radius: {
		inner: false,
		outter: false,
		padding: 0,
		round: 0,
	},
	value: false,
	color: {
		key: false,
		keys: false,
		scheme: false,
		current: "#1f77b4",
		default: "#AAA",
		axis: "#000",
	},
	currentKey: false,
	margin: {
		top: 40,
		right: 40,
		bottom: 40,
		left: 40,
	},
	transition: {
		duration: 100,
		ease: "easeLinear",
	},
};

const TEST_SUITE_PATH = '/api/test-suites/';
export default {
	components: {
		TestCase,
		MainLayout,
		FileTree,
		TestSuiteHistory,
		BreadCrumb,
		D3PieChart,
		DiffViewer,
		TestCaseState,
		FilePatternForm
	},
	data() {
		return {
			testSuite: null,
			openedTestCase: null,
			repositoryFilesTree: fileTreeUtils.defaultRootTree(),
			testsTree: null,
			testDirs: [],
			testSuiteStatusChart: null,
			testSuiteStatusChartConfig: {},
			testSuiteGitLog: null,
			testSuiteGitLogError: '',
			diffPopin: {
				show : false,
				testSuiteId: null,
				diff: {
					isEmpty: true
				},
				newStatuses: {}
			},
			toggleBranchPopin: {
				show: false,
				testSuiteId: null,
				availableGitBranches: [],
				selectedGitBranch: null
			},
			toggleFileSelectorPopin: {
				show: false,
				filePatterns: []
			}
		}
	},
	async mounted() {
		return this.initTestSuite();
	},
	watch: {
		'$route.params.testCaseId': function (testCaseId) {
			if (testCaseId) {
				this.openTest({path: decodeURIComponent(testCaseId)});
			} else {
				this.closeTest();
			}
		}
	},
	methods: {
		async initTestSuite() {
			const testSuiteId = this.$route.params.testSuiteId;
			const testCaseId = this.$route.params.testCaseId;
			let response;
			try {
				response = await this.$http.get(`${TEST_SUITE_PATH}${testSuiteId}`);
			} catch (resp) {
				window.location.href = '/';
			}
			if (response.status === 200) {
				this.testSuite = response.body;
				this.$store.commit('currentTestSuite', this.testSuite);
				breadCrumbEventBus.$emit('initCurrentTestSuite');
				const filePaths = this.testSuite.tests.map(testCase => testCase.testFilePath);
				const testFileMapping = {};
				this.testSuite.tests.forEach(testCase => {
					testFileMapping[`root/${testCase.testFilePath}`] = {
						testFilePath: testCase.testFilePath,
						basePath: testCase.basePath
					};
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
				this.testDirs = this.testSuite.testDirs.map(testDir => filePatternSignification.getPatternSignification(testDir));
				if (this.$store.state.testCaseStatuses) {
					this.testSuiteStatusChartData()
				} else {
					appConfigEventBus.$on('testCaseStatusesLoaded', this.testSuiteStatusChartData);
				}
				await this.initTestSuiteGitLog();
			}
			if (testCaseId) {
				this.openTest({path: decodeURIComponent(testCaseId)});
			} else {
				this.closeTest();
			}
			const allFilesResponse = await this.$http.get(`${TEST_SUITE_PATH}${testSuiteId}/repository/all-files`);
			if (allFilesResponse.status === 200) { // TODO manage error case
				this.repositoryFilesTree = fileTreeUtils.buildTree(allFilesResponse.body.filePaths, allFilesResponse.body.basePath);
			}
			window.app.$on('lang-changed', () => {
				this.testDirs = this.testSuite.testDirs.map(testDir => filePatternSignification.getPatternSignification(testDir));
			});
		},
		async initTestSuiteGitLog() {
			const logLimit = 5;
			const testSuiteGitPath = `${TEST_SUITE_PATH}${this.testSuite._id}/gitLog/${logLimit}`;
			try {
				const response = await this.$http.get(testSuiteGitPath);
				if (response.status === 200) {
					this.testSuiteGitLog = response.body;
				}
			} catch (resp) {
				this.testSuiteGitLogError = `Failed to load git log: ${resp.body}`;
			}
		},
		async solveTestSuiteDiff(testSuiteId, newGitBranch, newTestDirs = null) {
			try {
				this.diffPopin.newStatuses = {};
				this.diffPopin.testSuiteId = testSuiteId;
				const reqData = {};
				if (newGitBranch) {
					reqData.branchName = newGitBranch;
				}
				if (newTestDirs) {
					reqData.testDirs = newTestDirs.map(newTestDir => newTestDir.pattern)
				}
				this.diffPopin.diff = (await this.$http.post(`${TEST_SUITE_PATH}${testSuiteId}/diff`, reqData)).body;
				this.diffPopin.diff.modifiedPatches.forEach(patch => {
					this.diffPopin.newStatuses[patch.test.testFilePath] = null;
				});
				this.diffPopin.newStatuses = {};
				this.diffPopin.diff.targetBranch = newGitBranch;
				this.toggleBranchPopin.show = false;
				this.toggleFileSelectorPopin.show = false;
				this.diffPopin.show = true;
			} catch (e) {
				alert('Test suite diff failed');
			}
		},
		async toggleTestSuiteGitBranch(testSuiteId) {
			this.toggleBranchPopin.testSuiteId = testSuiteId;
			this.toggleBranchPopin.availableGitBranches = this.testSuite.repository._gitBranches;
			this.toggleBranchPopin.selectedGitBranch = this.testSuite.repository._curBranch;
			this.toggleBranchPopin.show = true;
		},
		toggleTestSuiteFileSelector() {
			this.toggleFileSelectorPopin.show = true;
		},
		changeTestStatus(testCaseId, oldTestStatus, newTestStatus) {
			this.diffPopin.newStatuses[testCaseId] = newTestStatus;
		},
		async submitNewTestsStatuses() {
			const nullStatus = Object.values(this.diffPopin.newStatuses).find(newStatus => newStatus === null);
			if (nullStatus !== undefined && !confirm('At least one modified test has not been validated, continue ?')) {
				return;
			}
			try {
				const reqData = {
					currentCommit: this.diffPopin.diff.currentCommit,
					targetCommit: this.diffPopin.diff.targetCommit,
					newStatuses: this.diffPopin.newStatuses,
					targetBranch: this.diffPopin.diff.targetBranch
				};

				if (this.toggleFileSelectorPopin.filePatterns.length > 0) {
					reqData.testDirs = this.toggleFileSelectorPopin.filePatterns.map(filePattern => filePattern.pattern)
				}
				const response = await this.$http.put(`${TEST_SUITE_PATH}${this.diffPopin.testSuiteId}/solve`, reqData);
				if (response.status !== 200) {
					alert(response.body);
					return;
				}
				await this.initTestSuite();
				this.hideDiffPopin();
			} catch (e) {
				alert('Test suite solving failed');
			}
		},
		hideDiffPopin() {
			this.diffPopin.show = false;
		},
		getTestCase(testCasePath) {
			return this.testSuite.tests.find(test => testCasePath === test.testFilePath);
		},
		openTest(testLink) {
			const test = this.getTestCase(testLink.path);
			if (test) {
				this.$store.commit('currentTestCase', test);
				breadCrumbEventBus.$emit('initCurrentTestCase');
				this.openedTestCase = test;
			}
		},
		closeTest() {
			this.$store.commit('currentTestCase', null);
			this.openedTestCase = null;
		},
		updateTestCaseDisplay() {
			return this.initTestSuite();
		},
		testSuiteStatusChartData() {
			const tests = this.testSuite.tests;
			const total = tests.length;
			const lang = this.$i18n.locale;

			const statuses = this.$store.state.testCaseStatuses.statuses;

			this.testSuiteStatusChart = statuses.map(status => {
				const part = tests.filter(test => test.status.name === status.name).length;
				const percent = Math.round((part / total) * 100);
				if (percent > 0) {
					return {
						name: status.lang[lang] || status.name,
						total: percent
					};
				}
			}).filter(status => status !== undefined);

			const colorsKeys = {};
			for (let status of statuses) {
				if (status.lang[lang]) {
					colorsKeys[status.lang[lang]] = status.color;
				} else {
					colorsKeys[status.name] = status.color;
				}

			}

			this.testSuiteStatusChartConfig = Object.assign({}, DEFAULT_TEST_SUITE_CHART_CONFIG, {
				key: 'name',
				value: 'total',
				color: {
					keys: colorsKeys
				}
			});
		},
		filePatternsChanged(newFilePatterns) {
			this.toggleFileSelectorPopin.filePatterns = newFilePatterns;
		}
	}
};
