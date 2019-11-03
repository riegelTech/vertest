'use strict';

import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';
import repositoriesMixin from '../repositories/repositories';

const TEST_SUITE_PATH = '/api/test-suites/';
const EMPTY_TEST_SUITE = {
	show: false,
	testSuiteName: '',
	selectedRepository: null,
	availableGitBranches: [],
	selectedGitBranch: null
};
function getEmptyTestSuitePopin() {
	return Object.assign({}, EMPTY_TEST_SUITE);
}

export default {
	components: {
		MainLayout
	},
	data() {
		return {
			createPopin: getEmptyTestSuitePopin(),
			testSuites: []
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
		showCreatePopin() {
			this.createPopin.show = true;
		},
		hideCreatePopin() {
			this.resetCreatePopin();
			this.createPopin.show = false;
		},
		resetCreatePopin() {
			this.createPopin = getEmptyTestSuitePopin();
		},
		selectRepository() {
			const selectedRepository = this.repositories.find(repository => repository.address === this.createPopin.selectedRepository);
			this.createPopin.availableGitBranches = selectedRepository.gitBranches;
		}
	}
}