'use strict';

import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';
import {FormWizard, TabContent} from 'vue-form-wizard';

import minimatch from 'minimatch';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';
import {userEventBus, userMixin} from '../users/users';
import {fileTreeUtils} from '../../components/fileTree.js';
import FileTree from '../../components/fileTree.vue';
import sshKeysMixin from '../ssh-keys/ssh-keys';
import DiffViewer from '../../components/diffViewer.vue';
import TestCaseState from '../../components/testCaseState.vue';

const defaultCurrentUser = null;
const TEST_SUITE_PATH = '/api/test-suites/';
const REPOSITORIES_PATH = '/api/repositories/';
const AUTHENTICATION_TYPES = {
	NONE: 'none',
	PASS: 'pass',
	KEY: 'key'
};
const EMPTY_TEST_SUITE = {
	show: false,
	activeStep: 'first',
	firstStepError: null,
	testSuiteName: '',
	repositoryAddress: '',
	repositoryAuthType: AUTHENTICATION_TYPES.NONE,
	repositoryLogin: '',
	repositoryPass: '',
	availableSshKeys: [],
	repositorySshKey: null,
	repositorySshKeyUser: '',
	repositorySshKeyPass: '',
	repositoryUuid: '',
	repositoryBranch: '',
	availableGitBranches: [],
	secondStepError: null,
	availableFilesTree: {},
	selectedFilesTree: {},
	fieldFilePattern: '',
	filePatterns: [],
	thirdStepError: null
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
		TabContent,
		FileTree
	},
	mixins: [userMixin, sshKeysMixin],
	data() {
		return {
			createPopin: getEmptyTestSuitePopin(),
			authTypes: AUTHENTICATION_TYPES,
			testSuites: [],
			sshKeys: [],
			loginPopup: {
				show: false
			},
			currentUser: defaultCurrentUser,
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
			waitSpinner: false
		};
	},
	async mounted() {
		userEventBus.$on('initCurrentUser', () => {
			this.currentUser = this.$store.state.currentUser;
			if (!this.$store.state.currentUser) {
				this.showLoginPopup();
			} else {
				this.initScreen();
			}
		});
		userEventBus.$on('userLogin', () => {
			this.currentUser = this.$store.state.currentUser;
			this.hideLoginPopup();
			this.initScreen();
		});
	},
	methods: {
		async initScreen() {
			await this.initTestSuites();
			this.createPopin.availableSshKeys = await this.getSshKeys();
		},
		async initTestSuites() {
			try {
				const response = await this.$http.get(TEST_SUITE_PATH);
				if (response.status === 200) {
					this.testSuites = response.body;
				}
				return true;
			} catch (resp) {
				this.showLoginPopup();
				return false;
			}
		},
		showSpinner() {
			this.waitSpinner = true;
		},
		hideSpinner() {
			this.waitSpinner = false;
		},
		hideLoginPopup() {
			this.loginPopup.show = false;
		},
		showLoginPopup() {
			this.loginPopup.show = true;
		},
		async sendCreateTestSuite() {
			this.showSpinner();
			try {
				const response = await this.$http.post(TEST_SUITE_PATH, {
					name: this.createPopin.testSuiteName,
					repoAddress: this.createPopin.selectedRepository,
					gitBranch: this.createPopin.selectedGitBranch
				});
				this.hideSpinner();
				if (response.status === 200) {
					await this.initTestSuites();
					return this.hideCreatePopin();
				}
			} catch (resp) {
				this.hideSpinner();
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
			const testSuite = this.testSuites.find(testSuite => testSuite._id === testSuiteId);
			this.toggleBranchPopin.testSuiteId = testSuiteId;
			this.toggleBranchPopin.availableGitBranches = testSuite.repository._gitBranches;
			this.toggleBranchPopin.selectedGitBranch = testSuite.repository._curBranch;
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
			this.createPopin.show = false;
			return this.resetCreatePopin();
		},
		hideDiffPopin() {
			this.diffPopin.show = false;
		},
		async resetCreatePopin() {
			this.createPopin = getEmptyTestSuitePopin();
			this.createPopin.availableSshKeys = await this.getSshKeys();
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
				if (!this.createPopin.repositorySshKey) {
					error = true;
				}
			}

			if (error === true) {
				this.createPopin.firstStepError = 'Invalid form';
				return;
			} else {
				this.createPopin.firstStepError = null;
			}
			this.showSpinner();
			try {
				const response = await this.$http.post(`${REPOSITORIES_PATH}temp`, {
					repositoryAddress: this.createPopin.repositoryAddress,
					repositoryAuthType: this.createPopin.repositoryAuthType,
					repositoryLogin: this.createPopin.repositoryLogin,
					repositoryPass: this.createPopin.repositoryPass,
					repositorySshKey: this.createPopin.repositorySshKey,
					repositorySshKeyUser: this.createPopin.repositorySshKeyUser,
					repositorySshKeyPass: this.createPopin.repositorySshKeyPass
				});
				this.hideSpinner();
				if (response.status === 200) {
					this.createPopin.availableGitBranches = response.body.branches;
					this.createPopin.repositoryUuid = response.body.repoUuid;
					this.createPopin.activeStep = 'second';
					return true;
				}
			} catch (resp) {
				this.hideSpinner();
				this.createPopin.firstStepError = 'Repository creation failed, please check its address and credentials';
			}
			return false;
		},
		async getRepoFiles() {
			if (!this.createPopin.repositoryBranch) {
				this.createPopin.secondStepError = 'Please choose GIT branch';
				return;
			}
			try {
				const response = await this.$http.post(`${REPOSITORIES_PATH}temp/${this.createPopin.repositoryUuid}/files`, {
					gitBranch: this.createPopin.repositoryBranch
				});
				if (response.status === 200) {
					this.createPopin.availableFilesTree = fileTreeUtils.buildTree(response.body.filePaths, response.body.basePath);
					this.createPopin.activeStep = 'third';
					this.updateMatchedFiles();
					return true;
				}
			} catch (resp) {
				console.error(resp);
			}
		},
		addFilePattern() {
			this.createPopin.filePatterns.push(this.createPopin.fieldFilePattern);
			this.createPopin.fieldFilePattern = '';

			this.updateMatchedFiles();
		},
		deleteFilePattern(filePatternIndex) {
			let firstChunk = [];
			if (filePatternIndex > 0) {
				firstChunk = this.createPopin.filePatterns.slice(0, filePatternIndex);
			}
			let lastChunk = [];
			if (filePatternIndex < this.createPopin.filePatterns.length) {
				lastChunk = this.createPopin.filePatterns.slice(filePatternIndex + 1);
			}
			this.createPopin.filePatterns = firstChunk.concat(lastChunk);
			this.updateMatchedFiles();
		},
		updateMatchedFiles() {
			if (this.createPopin.filePatterns.length === 0) {
				this.createPopin.selectedFilesTree = Object.assign({}, this.createPopin.availableFilesTree);
				return;
			}
			const flatFiles = fileTreeUtils.flattenLeafs(this.createPopin.availableFilesTree)
				.map(leaf => leaf.fullPath);
			const selectedFiles = flatFiles.filter(filePath => {
				return this.createPopin.filePatterns.some(filePattern => minimatch(filePath, filePattern));
			});
			this.createPopin.selectedFilesTree = fileTreeUtils.buildTree(selectedFiles, this.createPopin.availableFilesTree.path);
		},
		async createTestSuite() {
			try {
				const response = await this.$http.post(TEST_SUITE_PATH, {
					testSuiteName: this.createPopin.testSuiteName,
					repositoryUuid: this.createPopin.repositoryUuid,
					filePatterns: this.createPopin.filePatterns
				});
				if (response.status === 200) {
					await this.initTestSuites();
					return this.hideCreatePopin();
				}
			} catch (resp) {
				alert('Test suite creation failed');
			}
		}
	}
}