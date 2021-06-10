'use strict';

const express = require('express');
const router = express.Router();

const usersModule = require('../users/users');
const logs = require('../logsModule/logsModule').getDefaultLoggerSync();

async function login(req, res) {
	const login = req.body.login;
	const password = req.body.password;
	const eventuallySessId = usersModule.getSessId();

	function sendUnauthorized(res) {
		return res.status(401).send('Unauthorized');
	}

	try {
		if (await usersModule.authenticate(login, password, eventuallySessId)) {
			logs.info({message: `Login successful for user ${login}`});
			res.cookie('sessId', usersModule.getSessId());
			return res.status(200).send(usersModule.getCurrentUser());
		}
		logs.error({message: `Login fail for login ${login}`});
		return sendUnauthorized(res);
	} catch (e) {
		return sendUnauthorized(res);
	}
}

async function logout(req, res) {
	try {
		const eventuallySessId = usersModule.getSessId();
		const currentUser = usersModule.getUserBySessId(req.cookies.sessId);
		usersModule.deauthenticate(eventuallySessId);
		res.cookie('sessId', '');
		if (eventuallySessId) {

		}
		logs.info({message: `Logout for user ${currentUser.login}`});
		return res.status(200).send('OK');
	} catch (e) {
		logs.error({message: e.message});
		return sendUnauthorized(res);
	}
}

async function initSuperAdmin(req, res) {
	const password = req.body.password;
	const email = req.body.email;
	const firstName = req.body.firstName;
	const lastName = req.body.lastName;
	let suAdmin;
	try {
		suAdmin = await usersModule.getSuperAdmin();
	} catch (e) {
		logs.error({message: e.message});
		return res.status(500).send(e.message);
	}
	if (suAdmin) {
		logs.error({message: `Init super admin failed, super admin already initialized`});
		return res.status(403).send('Super user already exists');
	}
	try {
		await usersModule.addUser({
			login: usersModule.User.superAdminLogin,
			email,
			password,
			firstName,
			lastName,
			readOnly: false,
			hashPass: true
		});
		logs.info({message: `Super admin successfully initialized`});
		return res.status(200).send('OK');
	} catch (e) {
		logs.error({message: e.message});
		return res.status(500).send(e.message);
	}
}

async function getCurrentUser(req, res) {
	const sessIdCookie = req.cookies && req.cookies.sessId;

	function sendNotConnected(res) {
		return res.status(401).send('Not connected');
	}

	try {
		if (await usersModule.authenticate(undefined, undefined, sessIdCookie)) {
			res.cookie('sessId', usersModule.getSessId());
			const currentUser = usersModule.getCurrentUser();
			return res.status(200).send(currentUser);
		}
		return sendNotConnected(res);
	} catch (e) {
		if (e.code === 'ENOUSERFOUND') {
			return res.status(401).send({
				error: {
					code: e.code,
					message: e.message
				}
			});
		}
		return sendNotConnected(res);
	}
}

function avoid304(req, res, next) {
	res.setHeader('Last-Modified', (new Date()).toUTCString());
  next();
}

router.get('/*', avoid304)
	.post('/*', avoid304)
	.post('/login', login)
	.get('/logout', logout)
	.post('/init', initSuperAdmin)
	.get('/user', getCurrentUser);

module.exports = router;
