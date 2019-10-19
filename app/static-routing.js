'use strict';

// Do not use /api/* route, reserved for regular backend API routing
module.exports = {
	'/': 'home',
	'/init': 'init',
	'/users': 'users',
	'/test-suites': 'test-suites',
	'/repositories': 'repositories'
};
