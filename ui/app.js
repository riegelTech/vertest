'use strict';

import Vue from 'vue';
import page from 'page'

const routes = {
	'/index.html': 'home',
	'/init.html': 'init'
};

const app = new Vue({
	el: '#app-wrapper',
	data: {
		ViewComponent: { render: h => h('div', 'loading...') }
	},
	render (h) {
		return h(this.ViewComponent);
	}
});

Object.keys(routes).forEach(route => {
	const routeName = routes[route];
	const Component = require(`./pages/${routeName}/${routeName}.vue`);
	page(route, () => app.ViewComponent = Component.default);
});
page('*', () => app.ViewComponent = require('./pages/404.vue'));
page();