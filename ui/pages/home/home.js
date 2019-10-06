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
				show: false
			}
		};
	},
	mixins: [userMixin],
	mounted() {
		this.$on('initCurrentUser', () => {
			if (!this.$store.state.currentUser) {
				this.showLoginPopup();
			}
		});
		this.$on('userLogin', () => {
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
}