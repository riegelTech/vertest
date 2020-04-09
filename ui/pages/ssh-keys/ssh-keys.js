'use strict';


import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';

const SSH_KEYS_API_PATH = '/api/ssh-keys/';

export const sshKeysMixin = {
	data() {
		return {
			sshKeys: []
		};
	},
	methods: {
		async getSshKeys(forceRefresh) {
			if (!forceRefresh && this.$store.state.sshKeys.length > 0) {
				return this.$store.state.sshKeys;
			}
			const response = await this.$http.get(SSH_KEYS_API_PATH);
			if (response.status === 200) {
				this.$store.commit('sshKeys', response.body);
				return response.body;
			}
			throw new Error('No ssh keys found');
		}
	}
};

export default {
	components: {
		MainLayout
	},
	mixins: [sshKeysMixin],
	mounted() {
		return this.getSshKeys();
	},
	methods: {

	}
}