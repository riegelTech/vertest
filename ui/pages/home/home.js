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
			currentUser: {},
			loginPopup: {
				show: false,
				login: '',
				password: ''
			}
		};
	},
	async mounted() {
		try {
			const response = await this.$http.get('/auth/user');
			if (response.status === 200) {
				this.currentUser = response.body;
			}
		} catch (resp) {
			if (resp.body && resp.body.error && resp.body.error.code === 'ENOUSERFOUND') {
				window.location.href = '/init.html';
				return;
			}
			this.loginPopup.show = true;
		}
	},
	methods: {
		async login() {
			try {
				const response = await this.$http.post('/auth/login', {
					login: this.loginPopup.login,
					password: this.loginPopup.password
				});
				if (response.status === 200) {
					this.currentUser = response.body;
					this.hidePopup();
				}
			} catch (e) {

			}
		},
		hidePopup() {
			this.loginPopup.show = false;
		}
	}
}