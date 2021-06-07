'use strict';

import MainLayout from '../../layouts/main.vue';
import TestCase from '../../components/test-case.vue';
import FileTree from '../../components/fileTree.vue';
import TestSuiteHistory from '../../components/testSuiteHistory.vue';
import {fileTreeUtils} from '../../components/fileTree.js';
import BreadCrumb from '../../components/breadCrumb.vue';
import DiffViewer from '../../components/diffViewer.vue';
import TestCaseState from '../../components/testCaseState.vue';
import {breadCrumbEventBus} from '../../components/breadCrumb.vue';
import { D3PieChart } from 'vue-d3-charts';

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
		TestCaseState
	},
	data() {
		return {
			testSuite: null,
			openedTestCase: null,
			testsTree: null,
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
			try {
				const response = await this.$http.get(`${TEST_SUITE_PATH}${testSuiteId}`);
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
					this.testSuiteStatusChartData();
					await this.initTestSuiteGitLog();
				}
				if (testCaseId) {
					this.openTest({path: decodeURIComponent(testCaseId)});
				} else {
					this.closeTest();
				}
			} catch (resp) {
				window.location.href = '/';
			}
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
		async solveTestSuiteDiff(testSuiteId, newGitBranch) {
			try {
				this.diffPopin.newStatuses = {};
				this.diffPopin.testSuiteId = testSuiteId;
				this.diffPopin.diff = (await this.$http.post(`${TEST_SUITE_PATH}${testSuiteId}/diff`, {
					branchName: newGitBranch
				})).body;
				this.diffPopin.diff.modifiedPatches.forEach(patch => {
					this.diffPopin.newStatuses[patch.test.testFilePath] = null;
				});
				this.diffPopin.newStatuses = {};
				this.diffPopin.diff.targetBranch = newGitBranch;
				this.toggleBranchPopin.show = false;
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
		changeTestStatus(testCaseId, newTestStatus) {
			this.diffPopin.newStatuses[testCaseId] = newTestStatus;
		},
		async submitNewTestsStatuses() {
			const nullStatus = Object.values(this.diffPopin.newStatuses).find(newStatus => newStatus === null);
			if (nullStatus !== undefined && !confirm('At least one modified test has not been validated, continue ?')) {
				return;
			}
			try {
				const response = await this.$http.put(`${TEST_SUITE_PATH}${this.diffPopin.testSuiteId}/solve`, {
					currentCommit: this.diffPopin.diff.currentCommit,
					targetCommit: this.diffPopin.diff.targetCommit,
					newStatuses: this.diffPopin.newStatuses,
					targetBranch: this.diffPopin.diff.targetBranch
				});
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

			const statuses = {
				TODO: 0,
				IN_PROGRESS: 1,
				BLOCKED: 3,
				SUCCESS: 4,
				FAILED: 5
			};

			function getTestsStatusPercent(status, total) {
				const part = tests.filter(test => test.status === status).length;
				return Math.round((part / total) * 100);
			}

			const totalTodo = getTestsStatusPercent(statuses.TODO, total);
			const totalProgress = getTestsStatusPercent(statuses.IN_PROGRESS, total);
			const totalBlocked = getTestsStatusPercent(statuses.BLOCKED, total);
			const totalSuccess = getTestsStatusPercent(statuses.SUCCESS, total);
			const totalFailed = getTestsStatusPercent(statuses.FAILED, total);

			this.testSuiteStatusChart = [];
			function addStatus(statuses, statusChart) {
				for (let status of statuses) {
					if (status.total > 0) {
						statusChart.push(status);
					}
				}
			}
			addStatus([{
				name: "Success",
				total: totalSuccess
			}, {
				name: "Failed",
				total: totalFailed
			}, {
				name: "Blocked",
				total: totalBlocked
			}, {
				name: "In progress",
				total: totalProgress
			}, {
				name: "To do",
				total: totalTodo
			}], this.testSuiteStatusChart);

			this.testSuiteStatusChartConfig = Object.assign({}, DEFAULT_TEST_SUITE_CHART_CONFIG, {
				key: 'name',
				value: 'total',
				color: {
					// colors based on https://material.io/resources/color/#!/?view.left=0&view.right=0 picked on material palette on the third column (200)
					keys: {
						'To do': '#b0bec5', // Blue Grey
						'In progress': '#90caf9', // Blue
						'Blocked': '#ffcc80', // Orange
						'Success': '#a5d6a7', // Green
						'Failed': '#ef9a9a' // Red
					}
				}
			});
		}
	}
};
