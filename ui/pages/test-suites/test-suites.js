'use strict';

import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';
import {FormWizard, TabContent} from 'vue-form-wizard';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';
import repositoriesMixin from '../repositories/repositories';
import DiffViewer from '../../components/diffViewer.vue';
import TestCaseState from '../../components/testCaseState.vue';

const TEST_SUITE_PATH = '/api/test-suites/';
const REPOSITORIES_PATH = '/api/repositories/';
const AUTHENTICATION_TYPES = {
	NONE: 'none',
	PASS: 'pass',
	KEY: 'key'
};
const EMPTY_TEST_SUITE = {
	show: true,
	activeStep: 'first',
	firstStepError: null,
	testSuiteName: '',
	repositoryAddress: '',
	repositoryAuthType: AUTHENTICATION_TYPES.NONE,
	repositoryLogin: '',
	repositoryPass: '',
	repositoryKey: null,
	repositoryKeyPass: '',
	repositoryBranch: '',
	selectedRepository: null,
	availableGitBranches: [],
	selectedGitBranch: null
};
function getEmptyTestSuitePopin() {
	return Object.assign({}, EMPTY_TEST_SUITE);
}

export default {
	components: {
		MainLayout,
		DiffViewer,
		TestCaseState,
		FormWizard,
		TabContent
	},
	data() {
		return {
			createPopin: getEmptyTestSuitePopin(),
			authTypes: AUTHENTICATION_TYPES,
			testSuites: [],
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
		};
	},
	mixins: [repositoriesMixin],
	async mounted() {
		await this.initTestSuites();
		await this.initRepositories();
	},
	methods: {
		async initTestSuites() {
			try {
				const response = await this.$http.get(TEST_SUITE_PATH);
				if (response.status === 200) {
					this.testSuites = response.body;
				}
			} catch (resp) {
				window.location.href = '/';
			}
		},
		async sendCreateTestSuite() {
			try {
				const response = await this.$http.post(TEST_SUITE_PATH, {
					name: this.createPopin.testSuiteName,
					repoAddress: this.createPopin.selectedRepository,
					gitBranch: this.createPopin.selectedGitBranch
				});
				if (response.status === 200) {
					await this.initTestSuites();
					this.hideCreatePopin();
				}
			} catch (resp) {
				alert('Test suite creation failed');
			}
		},
		async deleteTestSuite(testId) {
			try {
				const response = await this.$http.delete(`${TEST_SUITE_PATH}${testId}`);
				if (response.status !== 200) {
					alert(response.body);
					return;
				}
				return this.initTestSuites();
			} catch (e) {
				alert('Test suite deletion failed');
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
			await this.initRepositories();
			const testSuite = this.testSuites.find(testSuite => testSuite._id === testSuiteId);
			this.toggleBranchPopin.testSuiteId = testSuiteId;
			const testSuiteRepository = this.repositories.find(repository => repository.address === testSuite.repoAddress);
			this.toggleBranchPopin.availableGitBranches = testSuiteRepository.gitBranches;
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
				await this.initTestSuites();
				this.hideDiffPopin();
			} catch (e) {
				alert('Test suite solving failed');
			}
		},
		showCreatePopin() {
			this.createPopin.show = true;
		},
		hideCreatePopin() {
			this.resetCreatePopin();
			this.createPopin.show = false;
		},
		hideDiffPopin() {
			this.diffPopin.show = false;
		},
		resetCreatePopin() {
			this.createPopin = getEmptyTestSuitePopin();
		},
		selectRepository() {
			const selectedRepository = this.repositories.find(repository => repository.address === this.createPopin.selectedRepository);
			this.createPopin.availableGitBranches = selectedRepository.gitBranches;
		},
		async getRepoBranches() {
			let error = false;
			if (!this.createPopin.testSuiteName) {
				error = true;
			}
			if (!this.createPopin.repositoryAddress) {
				error = true;
			}

			if (this.createPopin.repositoryAuthType === AUTHENTICATION_TYPES.PASS) {
				if (!this.createPopin.repositoryLogin || !this.createPopin.repositoryPass) {
					error = true;
				}
			}
			if (this.createPopin.repositoryAuthType === AUTHENTICATION_TYPES.KEY) {
				if (!this.createPopin.repositoryKey) {
					error = true;
				}
			}

			if (error === true) {
				this.createPopin.firstStepError = 'Invalid form';
				return;
			} else {
				this.createPopin.firstStepError = null;
			}
			try {
				const response = await this.$http.post(`${REPOSITORIES_PATH}temp`, {
					repositoryAddress: this.createPopin.repositoryAddress,
					repositoryAuthType: this.createPopin.repositoryAuthType,
					repositoryLogin: this.createPopin.repositoryLogin,
					repositoryPass: this.createPopin.repositoryPass,
					repositoryKey: this.createPopin.repositoryKey,
					repositoryKeyPass: this.createPopin.repositoryKeyPass
				});
				if (response.status === 200) {
					this.createPopin.availableGitBranches = response.body;
					return true;
				}
			} catch (resp) {
				console.error(resp);
			}
			return false;
			return new Promise(resolve => {
				setTimeout(() => {
					this.createPopin.activeStep = 'second';
					resolve(true);
				}, 2000);
			});
		}
	}
}