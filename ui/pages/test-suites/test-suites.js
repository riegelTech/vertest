'use strict';

import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue'

const TEST_SUITE_PATH = '/api/test-suites/';

export default {
	components: {
		MainLayout
	},
	data() {
		return {
			createPopin: {
				show: false,
				gitBranches: []
			},
			testSuites: []
		};
	},
	mounted() {
		return this.initTestSuites();
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
		showCreatePopin() {
			this.createPopin.show = true;
		}
	}
}