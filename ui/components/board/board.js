'use strict';

import Vue from 'vue';
import VueResource from 'vue-resource';
import Vuetify from 'vuetify'

Vue.use(VueResource);
Vue.use(Vuetify)

export default {
	data: function () {
		return {
			testSuites: [],
			newTestSuite: {
				name: '',
				gitRepoUrl: '',
				gitBranch: 'master',
				sourceDir: ''
			}
		};
	},
	mounted() {
		this.init();
	},
	methods: {
		async init() {
			const response = await this.$http.get('./test-suites/');
			this.testSuites = response.body;
		},
		async validate () {
			await this.$http.post('./test-suites/', this.newTestSuite);
		},
	}
};