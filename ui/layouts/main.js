'use strict';

import {userMixin} from '../pages/users/users';
import {userEventBus} from '../pages/users/users';

const defaultCurrentUser = null;

export default {
	mixins: [userMixin],
	data: () => ({
		showNavigation: false,
		showSidepanel: false,
		currentUser: defaultCurrentUser
	}),
	mounted() {
		userEventBus.$on('initCurrentUser', () => {
			this.currentUser = this.$store.state.currentUser;
		});
		userEventBus.$on('userLogin', () => {
			this.currentUser = this.$store.state.currentUser;
		});
	},
};
