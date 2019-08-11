'use strict';

const path = require('path');

const cookieParser = require('cookie-parser');
const createNamespace = require('cls-hooked').createNamespace;
const express = require('express');

const app = express();
app.use(express.json());
app.use(cookieParser());

const testSuiteRouting = require('./testSuites/testSuite-api');
const usersRouting = require('./users/users-api');
const usersModule = require('./users/users');

const initUrl = '/init.html';
const initApi = '/api/users/init/';

const sessionsCls = createNamespace('sessions');
app.use((req, res, next) => {
	sessionsCls.bindEmitter(req);
	sessionsCls.bindEmitter(res);
	sessionsCls.run(() => {
		next();
	});
});
app.all('/api/*', async function (req, res, next) {
	if (req.url === initUrl || req.url === initApi) return next();
	const login = req.body.login;
	const pass = req.body.pass;
	const sessIdCookie = req.cookies && req.cookies.sessId;

	function sendUnauthorized(res) {
		return res.status(401).send('Unauthorized');
	}

	try {
		if (await usersModule.authenticate(login, pass, sessIdCookie)) {
			res.cookie('sessId', usersModule.getSessId());
			return next();
		}
		return sendUnauthorized(res);
	} catch (e) {
		if (e.code === 'ENOUSERFOUND') {
			return res.redirect(initUrl)
		}
		return sendUnauthorized(res);
	}
});

async function login(req, res) {
	const login = req.body.login;
	const password = req.body.password;
	const eventuallySessId = usersModule.getSessId();
	try {
		if (await usersModule.authenticate(login, password, eventuallySessId)) {
			res.cookie('sessId', usersModule.getSessId());
			return res.status(200).send(usersModule.getCurrentUser());
		}
	} catch (e) {
		return res.status(401).send();
	}

}

app.post('/login/', login);

app.use('/', express.static(path.join(__dirname, '../ui/')));
app.use('/api/test-suites/', testSuiteRouting);
app.use('/api/users/', usersRouting);

app.listen(8080);
