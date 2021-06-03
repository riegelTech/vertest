'use strict';

import MainLayout from '../../layouts/main.vue';
import TestCase from '../../components/test-case.vue';
import FileTree from '../../components/fileTree.vue';
import TestSuiteHistory from '../../components/testSuiteHistory.vue';
import {fileTreeUtils} from '../../components/fileTree.js';
import BreadCrumb from '../../components/breadCrumb.vue';
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
		D3PieChart
	},
	data() {
		return {
			testSuite: null,
			openedTestCase: null,
			testsTree: null,
			testSuiteStatusChart: null,
			testSuiteStatusChartConfig: {},
			testSuiteProgressChart: null,
			testSuiteProgressChartConfig: {}
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
					this.testSuiteStatusChartData();
					this.testSuiteProgressionChartData();
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
		updateTestCase() {
			return this.initTestSuite();
		},
		testSuiteProgressionChartData() {
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

			this.testSuiteProgressChart = [{
				name: "Finished",
				total: totalSuccess + totalFailed
			}, {
				name: "To do",
				total: totalTodo
			}, {
				name: "In progress",
				total: totalBlocked + totalProgress
			}];
			// colors based on https://material.io/resources/color/#!/?view.left=0&view.right=0 picked on material palette on the Blue row
			this.testSuiteProgressChartConfig = Object.assign({}, DEFAULT_TEST_SUITE_CHART_CONFIG, {
				key: 'name',
				value: 'total',
				color: {
					keys: {
						'Finished': '#1565c0', // 800
						'To do': '#bbdefb', // 100
						'In progress': '#42a5f5' // 400
					}
				}
			});
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

			this.testSuiteStatusChart = [{
				name: "To do",
				total: totalTodo
			}, {
				name: "In progress",
				total: totalProgress
			}, {
				name: "Blocked",
				total: totalBlocked
			}, {
				name: "Success",
				total: totalSuccess
			}, {
				name: "Failed",
				total: totalFailed
			}];

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
