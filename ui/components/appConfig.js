'use strict';

import Vue from 'vue';

const CONFIG_PATH = '/api/config';
const TEST_CASE_STATUSES_PATH = '/api/statuses/';
const TEST_CASE_STATUSES_INCONSISTENCIES_PATH = `${TEST_CASE_STATUSES_PATH}inconsistencies`;

export const appConfigEventBus = new Vue();
export const statusesEndpoints = {
	TEST_CASE_STATUSES_PATH,
	TEST_CASE_STATUSES_INCONSISTENCIES_PATH
};
export const appConfig = {
	async mounted() {
		return this.initAppConfig();
	},
	methods: {
		async initAppConfig() {
			const appConfigResponse = await this.$http.get(CONFIG_PATH);
			if (appConfigResponse.status === 200) {
				this.appConfig = appConfigResponse.body;
				this.$store.commit('appConfig', this.appConfig);
				appConfigEventBus.$emit('appConfigLoaded');
			}

			const statusesResponse = await this.$http.get(TEST_CASE_STATUSES_PATH);
			if (statusesResponse.status === 200) {
				this.testCaseStatuses = statusesResponse.body;
				this.$store.commit('testCaseStatuses', this.testCaseStatuses);
				appConfigEventBus.$emit('testCaseStatusesLoaded');
			}

			const inconsistenciesResponse = await this.$http.get(TEST_CASE_STATUSES_INCONSISTENCIES_PATH);
			if (inconsistenciesResponse.status === 200) {
				this.testCaseStatusesInconsistencies = inconsistenciesResponse.body;
				this.$store.commit('testCaseStatusesInconsistencies', this.testCaseStatusesInconsistencies);
				appConfigEventBus.$emit('testCaseStatusesInconsistenciesLoaded');
			}
		}
	}
};