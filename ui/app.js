'use strict';

import Vue from 'vue';
import store from './store';
import VueRouter from 'vue-router';

Vue.use(VueRouter);

import homeComponent from './pages/home/home.vue';
import initComponent from './pages/init/init.vue';
import usersComponent from './pages/users/users.vue';
import testSuitesComponent from './pages/test-suites/test-suites.vue';
import oneTestSuiteComponent from './pages/test-suite/test-suite.vue';
import testCaseComponent from './pages/test-case/test-case.vue';
import repositoriesComponent from './pages/repositories/repositories.vue';

import pageNotFoundComponent from './pages/404.vue';

const router = new VueRouter({
	mode: 'hash',
	routes: [
		{ path: '/', component: homeComponent },
		{ path: '/init', component: initComponent },
		{ path: '/users', component: usersComponent},
		{ path: '/test-suites', component: testSuitesComponent},
		{ path: '/test-suites/:testSuiteId', component: oneTestSuiteComponent},
		{ path: '/test-suites/:testSuiteId/test-case/:testCaseId', component: testCaseComponent},
		{ path: '/repositories', component: repositoriesComponent},
		{ path: '*', component: pageNotFoundComponent}
	]
});

new Vue({
	store,
	router
}).$mount('#app-wrapper');