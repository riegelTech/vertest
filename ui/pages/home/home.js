'use strict';

import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';
import {userMixin} from '../users/users';
import {userEventBus} from '../users/users';

const defaultCurrentUser = null;

export default {
	components: {
		MainLayout
	},
	data() {
		return {
			loginPopup: {
				show: false
			},
			currentUser: defaultCurrentUser
		}
	},
	mixins: [userMixin],
	mounted() {
		userEventBus.$on('initCurrentUser', () => {
			this.currentUser = this.$store.state.currentUser;
			if (!this.$store.state.currentUser) {
				this.showLoginPopup();
			}
		});
		userEventBus.$on('userLogin', () => {
			this.currentUser = this.$store.state.currentUser;
			this.hideLoginPopup();
		});
	},
	methods: {
		hideLoginPopup() {
			this.loginPopup.show = false;
		},
		showLoginPopup() {
			this.loginPopup.show = true;
		}
	}
};
