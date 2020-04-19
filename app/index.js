'use strict';

const path = require('path');

const cookieParser = require('cookie-parser');
const createNamespace = require('cls-hooked').createNamespace;
const express = require('express');

const appConfig = require('./appConfig/config');
const sshKeysModule = require('./sshKeys/ssh-keys');

const app = express();
app.use(express.json());
app.use(cookieParser());

const testSuiteModule = require('./testSuites/testSuite');
const testSuiteRouting = require('./testSuites/testSuite-api');
const usersRouting = require('./users/users-api');
const usersModule = require('./users/users');
const authRouting = require('./auth/auth-api');
const repositoriesRouting = require('./repositories/repositories-api');
const sshKeyRouting = require('./sshKeys/ssh-keys-api');

const sessionsCls = createNamespace('sessions');
app.use((req, res, next) => {
	sessionsCls.bindEmitter(req);
	sessionsCls.bindEmitter(res);
	sessionsCls.run(() => {
		next();
	});
});
app.all('/api/*', async function (req, res, next) {
	const sessIdCookie = req.cookies && req.cookies.sessId;

	function sendUnauthorized(res) {
		return res.status(401).send('Unauthorized');
	}

	try {
		if (await usersModule.authenticate(undefined, undefined, sessIdCookie)) {
			res.cookie('sessId', usersModule.getSessId());
			return next();
		}
		return sendUnauthorized(res);
	} catch (e) {
		return sendUnauthorized(res);
	}
});

// API routes
app.use('/api/test-suites/', testSuiteRouting);
app.use('/api/users/', usersRouting);
app.use('/api/repositories/', repositoriesRouting);
app.use('/api/ssh-keys/', sshKeyRouting);
app.use('/auth/', authRouting);
// Static routes
const uiPath = path.join(__dirname, '../ui/');
app.use('/', express.static(uiPath));


const startApp = async () => {
	const config = await appConfig.getAppConfig();
	const port = config.server.port;
	try {
		await testSuiteModule.initTestSuiteRepositories();
		await sshKeysModule.initSshKeys();
		await testSuiteModule.watchTestSuitesChanges();
	} catch (e) {
		console.error(e);
	}

	console.log(`Start server on port ${port}`);
	app.listen(port);
};

startApp();
