'use strict';


import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';

const EMPTY_USER = {
	show: false,
	_id: '',
	login: '',
	pass: '',
	pass2: '',
	email: '',
	firstName: '',
	lastName: ''
};
const USER_API_PATH = '/api/users/';

export default {
	components: {
		MainLayout
	},
	data() {
		return {
			users: [],
			userPopin: EMPTY_USER,
			error: '',
			currentUser: {}
		};
	},
	mounted() {
		return this.initUsers();
	},
	methods: {
		async initUsers() {
			try {
				const response = await this.$http.get('/auth/user');
				if (response.status === 200) {
					this.currentUser = response.body;
				}
			} catch (resp) {
				if (resp.body && resp.body.error && resp.body.error.code === 'ENOUSERFOUND') {
					window.location.href = '/init';
					return;
				}
			}

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
				pass: '',
				pass2: '',
				show: true
			});
		},
		showCreatePopin() {
			this.reinitUser();
			this.userPopin.show = true;
		},
		async sendUser() {
			if (this.userPopin.pass.length < 8) {
				this.error = 'Password is too weak';
				return;
			}
			if (this.userPopin.pass !== this.userPopin.pass2) {
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
					pass: this.userPopin.pass,
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
					pass: this.userPopin.pass,
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
		}
	}
}