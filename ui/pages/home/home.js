'use strict';

import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';
import {userMixin} from '../users/users';

export default {
	components: {
		MainLayout
	},
	data() {
		return {
			loginPopup: {
				show: false,
				login: '',
				password: ''
			}
		};
	},
	mixins: [userMixin],
	methods: {
		async login() {
			try {
				const response = await this.$http.post('/auth/login', {
					login: this.loginPopup.login,
					password: this.loginPopup.password
				});
				if (response.status === 200) {
					this.$store.commit('currentUser', response.body);
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