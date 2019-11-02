'use strict';

import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';
import repositoriesMixin from '../repositories/repositories';

const TEST_SUITE_PATH = '/api/test-suites/';

export default {
	components: {
		MainLayout
	},
	data() {
		return {
			createPopin: {
				show: false,
				testSuiteName: '',
				selectedRepository: null,
				availableGitBranches: [],
				selectedGitBranch: null
			},
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

				});
				if (response.status === 200) {
					return this.initTestSuites();
				}
			} catch (resp) {
				alert('Test suite creation failed');
			}
		},
		showCreatePopin() {
			this.createPopin.show = true;
		},
		selectRepository() {
			const selectedRepository = this.repositories.find(repository => repository.name === this.createPopin.selectedRepository);
			this.createPopin.availableGitBranches = selectedRepository.gitBranches;
		}
	}
}