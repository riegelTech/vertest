'use strict';

const path = require('path');

const cookieParser = require('cookie-parser');
const createNamespace = require('cls-hooked').createNamespace;
const express = require('express');

const appConfig = require('./appConfig/config');
const logsModule = require('./logsModule/logsModule');
const migration = require('./db/migration');
const statusesModule = require('./testCase/testCaseStatuses');
const utils = require('./utils');

const app = express();
app.use(express.json());
app.use(cookieParser());

const sessionsCls = createNamespace('sessions');
app.use((req, res, next) => {
	sessionsCls.bindEmitter(req);
	sessionsCls.bindEmitter(res);
	sessionsCls.run(() => {
		next();
	});
});

const startApp = async () => {
	const config = await appConfig.getAppConfig();
	const logs = await logsModule.getDefaultLogger();
	await migration.startMigration();

	const port = config.server.port;

	const testSuiteModule = require('./testSuites/testSuite');
	const testCaseStatusesRouting = require('./testCase/testCaseStatuses-api');
	const testSuiteRouting = require('./testSuites/testSuite-api');
	const usersRouting = require('./users/users-api');
	const usersModule = require('./users/users');
	const authRouting = require('./auth/auth-api');
	const repositoriesRouting = require('./repositories/repositories-api');
	const sshKeyRouting = require('./sshKeys/ssh-keys-api');
	const sshKeysModule = require('./sshKeys/ssh-keys');

	try {
		await statusesModule.loadStatusesFromConfig();
		await testSuiteModule.initTestSuiteRepositories();
		await sshKeysModule.initSshKeys();
		await testSuiteModule.watchTestSuitesChanges();
	} catch (e) {
		logs.error({message: e.message});
	}

	// API routes
	app.all('/api/*', async function (req, res, next) {
		const sessIdCookie = req.cookies && req.cookies.sessId;

		function sendUnauthorized(res, httpCode = utils.RESPONSE_HTTP_CODES.UNAUTHORIZED, message = 'Unauthorized') {
			return res.status(httpCode).send(message);
		}

		try {
			if (await usersModule.authenticate(undefined, undefined, sessIdCookie)) {
				const curUser = usersModule.getCurrentUser();
				res.cookie('sessId', usersModule.getSessId());
				const isPathForUserMod = req.path.startsWith('/api/users/') && req.method === 'PUT';
				if (req.method !== 'GET' && curUser && curUser.readOnly && !isPathForUserMod) { // general protection against read only users
					return sendUnauthorized(res, utils.RESPONSE_HTTP_CODES.REFUSED, `User "${curUser.login}" (${curUser._id}) is readonly`);
				}
				return next();
			}
			return sendUnauthorized(res);
		} catch (e) {
			return sendUnauthorized(res);
		}
	});
	app.use('/api/statuses/', testCaseStatusesRouting);
	app.use('/api/test-suites/', testSuiteRouting);
	app.use('/api/users/', usersRouting);
	app.use('/api/repositories/', repositoriesRouting);
	app.use('/api/ssh-keys/', sshKeyRouting);
	app.use('/auth/', authRouting);
// Static routes
	const uiPath = path.join(__dirname, '../ui/');
	app.use('/', express.static(uiPath));
	app.use('/api/config', async function (req, res) {
		res.send(config);
	});

	const cloneDir = config.workspace.repositoriesDir;
	app.use('/repositoriesStatics/', express.static(cloneDir));

	logs.log({level: 'info', message: `Start server on port ${port}`});
	return new Promise(res => {
		app.listen(port, () => {
			res()
		});
	});
};

startApp();
