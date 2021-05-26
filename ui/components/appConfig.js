'use strict';

import Vue from 'vue';

const CONFIG_PATH = '/api/config';

export const appConfigEventBus = new Vue();
export const appConfig = {
	async mounted() {
		return this.initAppConfig();
	},
	methods: {
		async initAppConfig() {
			const response = await this.$http.get(CONFIG_PATH);
			if (response.status === 200) {
				this.appConfig = response.body;
				this.$store.commit('appConfig', this.appConfig);
				appConfigEventBus.$emit('appConfigLoaded');
			}
		}
	}
};