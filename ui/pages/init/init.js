'use strict';

import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue'
export default {
	components: {
		MainLayout
	},
	data() {
		return {
			password: '',
			password_2: '',
			email: '',
			firstName: '',
			lastName: '',
			error: ''
		};
	},
	methods: {
		async send() {
			if (this.password.length < 8) {
				this.error = 'Password is too weak';
				return;
			}
			if (this.password !== this.password_2) {
				this.error = 'Passwords differs';
				return;
			}
			this.error = '';
			try {
				const response = await this.$http.post(`/api/users/init/`, {
					password: this.password,
					email: this.email,
					firstName: this.firstName,
					lastName: this.lastName
				});
				if (response.status !== 200) {
					alert(response.body);
				}
				this.password = this.password_2 = this.email = this.firstName = this.lastName = '';
			} catch (e) {
				alert('Password initialization failed');
			}
		}
	}
}