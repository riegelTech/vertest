'use strict';

import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';
import {FormWizard, TabContent} from 'vue-form-wizard';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';
import {userEventBus} from '../users/userMixin';
import {userMixin} from '../users/userMixin';
import {fileTreeUtils} from '../../components/fileTree.js';
import FileTree from '../../components/fileTree.vue';
import sshKeysMixin from '../ssh-keys/ssh-keys';
import FilePatternForm from '../../components/filePatternForm.vue';

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
	availableFilesTree: fileTreeUtils.defaultRootTree(),
	selectedFilesTree: null,
	filePatterns: [],
	thirdStepError: null
};

function getEmptyTestSuitePopin() {
	return Object.assign({}, EMPTY_TEST_SUITE);
}

export default {
	components: {
		MainLayout,
		FormWizard,
		TabContent,
		FileTree,
		FilePatternForm
	},
	mixins: [userMixin, sshKeysMixin],
	data() {
		return {
			createPopin: getEmptyTestSuitePopin(),
			authTypes: AUTHENTICATION_TYPES,
			testSuites: [],
			sshKeys: [],
			loginPopup: {
				show: false,
				authError: null,
				loginFieldMessageClass: '',
				passwordFieldMessageClass: ''
			},
			currentUser: defaultCurrentUser,
			appConfig: null,
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
		userEventBus.$on('userLoginFail', () => {
			const errorClass = 'md-invalid';
			this.loginPopup.loginFieldMessageClass = this.userLogin ? '' : errorClass;
			this.loginPopup.passwordFieldMessageClass = this.userPassword ? '' : errorClass;
			this.loginPopup.authError = this.$t("message.Invalid login or password, please retry");
		});
	},
	methods: {
		async initScreen() {
			await this.initTestSuites();
			this.createPopin.availableSshKeys = await this.getSshKeys();
			if (this.createPopin.availableSshKeys.length > 0) {
				this.createPopin.repositorySshKey = this.createPopin.availableSshKeys[0].name;
			}
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
		showCreatePopin() {
			this.createPopin.show = true;
		},
		hideCreatePopin() {
			this.createPopin.show = false;
			return this.resetCreatePopin();
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
					if (this.createPopin.availableGitBranches.length > 0 && this.createPopin.availableGitBranches.find(branch => branch === 'master')) {
						this.createPopin.repositoryBranch = 'master';
					}
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
					return true;
				}
			} catch (resp) {
				console.error(resp);
			}
		},
		filePatternsChanged(newFilePatterns) {
			this.createPopin.filePatterns = newFilePatterns;
		},
		async createTestSuite() {
			try {
				const response = await this.$http.post(TEST_SUITE_PATH, {
					testSuiteName: this.createPopin.testSuiteName,
					repositoryUuid: this.createPopin.repositoryUuid,
					filePatterns: this.createPopin.filePatterns.map(fullPattern => fullPattern.pattern)
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