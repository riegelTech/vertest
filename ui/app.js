'use strict';

import Vue from 'vue';
import store from './store';
import VueRouter from 'vue-router';

Vue.use(VueRouter);

import initComponent from './pages/init/init.vue';
import usersComponent from './pages/users/users.vue';
import testSuitesComponent from './pages/test-suites/test-suites.vue';
import oneTestSuiteComponent from './pages/test-suite/test-suite.vue';
import testCaseComponent from './pages/test-case/test-case.vue';
import sshKeysComponent from './pages/ssh-keys/ssh-keys.vue';

import pageNotFoundComponent from './pages/404.vue';

const router = new VueRouter({
	mode: 'hash',
	routes: [
		{ path: '/', component: testSuitesComponent },
		{ path: '/init', component: initComponent },
		{ path: '/users', component: usersComponent},
		{ path: '/test-suites/:testSuiteId', component: oneTestSuiteComponent},
		{ path: '/test-suites/:testSuiteId/test-case/:testCaseId', component: oneTestSuiteComponent},
		{ path: '/ssh-keys', component: sshKeysComponent},
		{ path: '*', component: pageNotFoundComponent}
	]
});

new Vue({
	store,
	router
}).$mount('#app-wrapper');