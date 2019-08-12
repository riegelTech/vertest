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
const authRouting = require('./auth/auth-api');

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

app.use('/', express.static(path.join(__dirname, '../ui/')));
app.use('/api/test-suites/', testSuiteRouting);
app.use('/api/users/', usersRouting);
app.use('/auth/', authRouting);

app.listen(8080);
