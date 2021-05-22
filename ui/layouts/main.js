'use strict';

import {userMixin} from '../pages/users/userMixin';
import {userEventBus} from '../pages/users/userMixin';

const defaultCurrentUser = null;

export default {
	mixins: [userMixin],
	data: () => ({
		showNavigation: false,
		showSidepanel: false,
		currentUser: defaultCurrentUser,
		sshKeys: []
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
