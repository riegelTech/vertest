'use strict';


import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';


Vue.use(VueMaterial);
Vue.use(VueResource);

import {userMixin} from './userMixin';
import {mainWrapperEventBus} from '../../layouts/main-event-bus';
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
	lastName: '',
	readOnly: false
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
		mainWrapperEventBus.$once('appReady', this.initUsers);
	},
	methods: {
		async initUsers() {
			try {
				this.users =  await this.getUsers(true);
			} catch (resp) {
				return false;
			}
		},
		reinitUser() {
			this.userPopin = Object.assign({}, EMPTY_USER);
			this.error = '';
		},
		showEditPopin(user) {
			this.userPopin = Object.assign({}, this.userPopin, EMPTY_USER, user, {
				password: '',
				password2: '',
				show: true,
				editUser: true
			});
			this.error = '';
		},
		showCreatePopin() {
			this.reinitUser();
			this.userPopin.show = true;
			this.userPopin.editUser = false;
		},
		async sendUser() {
			if (this.userPopin.password.length < 8) {
				this.error = this.$t('adminInitForm.Password is too weak');
				return;
			}
			if (this.userPopin.password !== this.userPopin.password2) {
				this.error = this.$t('adminInitForm.Passwords differs');
				return;
			}
			this.error = '';
			// update user
			if (this.userPopin._id) {
				return this.updateUser();
			}
			return this.addUser();
		},
		async addUser() {
			try {
				const response = await this.$http.post(this.getUserApiPath(), {
					login: this.userPopin.login,
					password: this.userPopin.password,
					email: this.userPopin.email,
					firstName: this.userPopin.firstName,
					lastName: this.userPopin.lastName,
					readOnly: this.userPopin.readOnly
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
				const response = await this.$http.put(`${this.getUserApiPath()}${this.userPopin._id}`, {
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
				const response = await this.$http.delete(`${this.getUserApiPath()}${userUuid}`);
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