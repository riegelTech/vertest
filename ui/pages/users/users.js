'use strict';


import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';

export default {
	components: {
		MainLayout
	},
	data() {
		return {
			users: []
		};
	},
	async mounted() {
		try {
			const response = await this.$http.get('/api/users/');
			if (response.status === 200) {
				this.users = response.body;
			}
		} catch (resp) {
			window.location.href = '/';
		}
	},
	methods: {

	}
}