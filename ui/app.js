'use strict';

import Vue from 'vue';
import store from './store';
import VueRouter from 'vue-router';
import VueI18n from "vue-i18n";

Vue.use(VueRouter);
Vue.use(VueI18n);

import en from './locales/en';

import setFilters from './filters';
import initComponent from './pages/init/init.vue';
import usersComponent from './pages/users/users.vue';
import testSuitesComponent from './pages/test-suites/test-suites.vue';
import oneTestSuiteComponent from './pages/test-suite/test-suite.vue';
import sshKeysComponent from './pages/ssh-keys/ssh-keys.vue';
import markdownVisualizer from './components/markdownVisualizer.vue';

import pageNotFoundComponent from './pages/404.vue';

const router = new VueRouter({
	mode: 'hash',
	routes: [
		{ path: '/', redirect: '/en/'},
		{ path: '/:lang/', component: testSuitesComponent},
		{ path: '/:lang/init', component: initComponent },
		{ path: '/:lang/users', component: usersComponent},
		{
			path: '/:lang/test-suites/:testSuiteId',
			component: oneTestSuiteComponent,
			children: [
				{ path: '/:lang/test-suites/:testSuiteId/test-case/:testCaseId', component: oneTestSuiteComponent}
			]
		},
		{ path: '/:lang/ssh-keys', component: sshKeysComponent},
		{ path: '/:lang/mdvisu/:resource', component:markdownVisualizer},
		{ path: '/*', component: pageNotFoundComponent}
	]
});

const messages = {};
const locales = require.context(
	"./locales",
	true,
	/[A-Za-z0-9-_,\s]+\.json$/i
);
locales.keys().forEach(key => {
	const matched = key.match(/([A-Za-z0-9-_]+)\./i);
	if (matched && matched.length > 1) {
		const locale = matched[1];
		messages[locale] = locales(key);
	}
});
const i18n = new VueI18n({
	locale: "en",
	fallbackLocale: "en",
	messages
});

setFilters();

window.app = new Vue({
	store,
	router,
	i18n
}).$mount('#app-wrapper');

i18n.locale = router.currentRoute.params.lang;
router.beforeEach((to, from, next) => {
	i18n.locale = to.params.lang;
	window.app.$emit('lang-changed', i18n.locale);
	next();
});
