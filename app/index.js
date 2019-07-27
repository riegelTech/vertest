'use strict';

const path = require('path');

const cookieParser = require('cookie-parser');
const express = require('express');
const app = express();
app.use(express.json());
app.use(cookieParser());

const testSuiteRouting = require('./testSuites/testSuite-api');
const usersRouting = require('./users/users-api');
const usersModule = require('./users/users');

app.all('/api/*', async function (req, res, next) {
	try {
		const login = req.body.login;
		const pass = req.body.pass;
		const sessId = req.cookie.sessId;
		if(await usersModule.authenticate(login, pass, sessId)) {
			res.cookie('sessId', usersModule.getSessId());
			return next();
		}
	} catch (e) {
		if (e.code === 'ENOUSERFOUND') {
			return res.redirect('/init.html')
		}
		return res.status(401).send('Unauthorized');
	}
});

app.use(express.static(path.join(__dirname, '../ui/')));
app.use('/api/test-suites/', testSuiteRouting);
app.use('/api/users/', usersRouting);

app.listen(8080);
