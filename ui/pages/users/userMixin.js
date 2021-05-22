'use strict';

import Vue from 'vue';

const USER_API_PATH = '/api/users/';
const AUTH_API_PATH = '/auth/user';


export const userEventBus = new Vue();
export const userMixin = {
	data() {
		return {
			userLogin: '',
			userPassword: '',
			currentUser: null
		};
	},
	async mounted() {
		try {
			const response = await this.$http.get(AUTH_API_PATH);
			if (response.status === 200) {
				this.currentUser = response.body;
				this.$store.commit('currentUser', response.body);
			}
		} catch (resp) {
			if (resp.body && resp.body.error && resp.body.error.code === 'ENOUSERFOUND') {
				window.location.href = '#/init';
				return;
			}
		}
		userEventBus.$emit('initCurrentUser');
	},
	methods: {
		async login() {
			try {
				const response = await this.$http.post('/auth/login', {
					login: this.userLogin,
					password: this.userPassword
				});
				if (response.status === 200) {
					this.currentUser = response.body;
					this.$store.commit('currentUser', response.body);
					userEventBus.$emit('userLogin');
				}
			} catch (e) {

			}
		},
		async logout() {
			try {
				const response = await this.$http.get('/auth/logout');
				if (response.status === 200) {
					this.currentUser = null;
					this.$store.commit('currentUser', this.currentUser);
					userEventBus.$emit('userLogout');
					window.location.href = '/';
				}
			} catch (e) {

			}
		},
		async getUsers(forceRefresh) {
			if (!forceRefresh && this.$store.state.users.length > 0) {
				return this.$store.state.users;
			}
			const response = await this.$http.get(USER_API_PATH);
			if (response.status === 200) {
				this.$store.commit('users', response.body);
				return response.body;
			}
			throw new Error('No user found');
		},
		getUserApiPath() {
			return USER_API_PATH
		},
		getAuthApiPath() {
			return AUTH_API_PATH
		}
	}
};