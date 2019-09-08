'use strict';


import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';

const EMPTY_USER = {
	show: false,
	editUser: false,
	_id: '',
	login: '',
	password: '',
	password2: '',
	email: '',
	firstName: '',
	lastName: ''
};
const USER_API_PATH = '/api/users/';
const AUTH_API_PATH = '/auth/user';

export const userMixin = {
	async mounted() {
		try {
			const response = await this.$http.get(AUTH_API_PATH);
			if (response.status === 200) {
				this.$store.commit('currentUser', response.body);
			}
		} catch (resp) {
			if (resp.body && resp.body.error && resp.body.error.code === 'ENOUSERFOUND') {
				window.location.href = '/init';
				return;
			}
		}
	}
};

export default {
	components: {
		MainLayout
	},
	data() {
		return {
			users: [],
			userPopin: EMPTY_USER,
			error: ''
		};
	},
	mixins: [userMixin],
	mounted() {
		return this.initUsers();
	},
	computed: {
		currentUser () {
			return this.$store.state.currentUser;
		}
	},
	methods: {
		async initUsers() {
			try {
				const response = await this.$http.get(USER_API_PATH);
				if (response.status === 200) {
					this.users = response.body;
				}
			} catch (resp) {
				window.location.href = '/';
			}
		},
		reinitUser() {
			this.userPopin = Object.assign({}, EMPTY_USER);
		},
		showEditPopin(user) {
			this.userPopin = Object.assign({}, this.userPopin, EMPTY_USER, user, {
				password: '',
				password2: '',
				show: true,
				editUser: true
			});
		},
		showCreatePopin() {
			this.reinitUser();
			this.userPopin.show = true;
			this.userPopin.editUser = false;
		},
		async sendUser() {
			if (this.userPopin.password.length < 8) {
				this.error = 'Password is too weak';
				return;
			}
			if (this.userPopin.password !== this.userPopin.password2) {
				this.error = 'Passwords differs';
				return;
			}
			// update user
			if (this.userPopin._id) {
				return this.updateUser();
			}
			return this.addUser();
		},
		async addUser() {
			try {
				const response = await this.$http.post(USER_API_PATH, {
					login: this.userPopin.login,
					password: this.userPopin.password,
					email: this.userPopin.email,
					firstName: this.userPopin.firstName,
					lastName: this.userPopin.lastName
				});
				if (response.status !== 200) {
					alert(response.body);
					return;
				}
				this.reinitUser();
				return this.initUsers();
			} catch (e) {
				alert('User creation failed');
			}
		},
		async updateUser() {
			try {
				const response = await this.$http.put(`${USER_API_PATH}${this.userPopin._id}`, {
					login: this.userPopin.login,
					password: this.userPopin.password,
					email: this.userPopin.email,
					firstName: this.userPopin.firstName,
					lastName: this.userPopin.lastName
				});
				if (response.status !== 200) {
					alert(response.body);
					return;
				}
				this.reinitUser();
				return this.initUsers();
			} catch (e) {
				alert('User update failed');
			}
		},
		async deleteUser(userUuid) {
			try {
				const response = await this.$http.delete(`${USER_API_PATH}${userUuid}`);
				if (response.status !== 200) {
					alert(response.body);
					return;
				}
				return this.initUsers();
			} catch (e) {
				alert('User deletion failed');
			}
		}
	}
}