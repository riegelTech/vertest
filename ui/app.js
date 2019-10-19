'use strict';

import Vue from 'vue';
import page from 'page';
import store from './store';

import routes from '../app/static-routing';

const app = new Vue({
	el: '#app-wrapper',
	store,
	data: {
		ViewComponent: { render: h => h('div', 'loading...') }
	},
	render (h) {
		return h(this.ViewComponent);
	}
});
const allRoutes = {...routes.pages, ...routes.utilsPages};
Object.keys(allRoutes).forEach(route => {
	const routeName = allRoutes[route];
	const Component = require(`./pages/${routeName}/${routeName}.vue`);
	page(route, () => app.ViewComponent = Component.default);
});
page('*', () => app.ViewComponent = require('./pages/404.vue'));
page();