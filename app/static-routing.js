'use strict';

// Do not use /api/* route, reserved for regular backend API routing
module.exports = {
	pages: {
		'/': 'home',
		'/users': 'users',
		'/test-suites': 'test-suites',
		'/repositories': 'repositories'
	},
	utilsPages: {
		'/init': 'init'
	}
};
