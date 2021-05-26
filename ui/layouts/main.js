'use strict';

import {appConfig, appConfigEventBus} from '../components/appConfig';
import {userMixin, userEventBus} from '../pages/users/userMixin';

const defaultCurrentUser = null;

export default {
	mixins: [userMixin, appConfig],
	data: () => ({
		showNavigation: false,
		showSidepanel: false,
		currentUser: defaultCurrentUser,
		appConfig: null,
		sshKeys: []
	}),
	mounted() {
		appConfigEventBus.$on('appConfigLoaded', () => {
			this.appConfig = this.$store.state.appConfig;
		});
		userEventBus.$on('initCurrentUser', () => {
			this.currentUser = this.$store.state.currentUser;
		});
		userEventBus.$on('userLogin', () => {
			this.currentUser = this.$store.state.currentUser;
		});
	},
};
