'use strict';

import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
	state: {
		currentUser: null,
		users: [],
		sshKeys: [],
		appConfig: null
	},
	mutations: {
		currentUser (state, user) {
			state.currentUser = user;
		},
		users (state, users) {
			state.users = users;
		},
		sshKeys (state, sshKeys) {
			state.sshKeys = sshKeys;
		},
		appConfig (state, appConfig) {
			state.appConfig = appConfig;
		}
	}
});
