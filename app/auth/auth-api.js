'use strict';

const express = require('express');
const router = express.Router();

const usersModule = require('../users/users');

async function login(req, res) {
	const login = req.body.login;
	const password = req.body.password;
	const eventuallySessId = usersModule.getSessId();

	function sendUnauthorized(res) {
		return res.status(401).send('Unauthorized');
	}

	try {
		if (await usersModule.authenticate(login, password, eventuallySessId)) {
			res.cookie('sessId', usersModule.getSessId());
			return res.status(200).send(usersModule.getCurrentUser());
		}
		return sendUnauthorized(res);
	} catch (e) {
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
		return res.status(500).send(e.message);
	}
	if (suAdmin) {
		return res.status(403).send('Super user already exists');
	}
	try {
		await usersModule.addUser({
			login: usersModule.User.superAdminLogin,
			email,
			pass: password,
			firstName,
			lastName,
			readOnly: false,
			hashPass: true
		});
		return res.status(200).send('OK');
	} catch (e) {
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

router.post('/login', login)
	.post('/init', initSuperAdmin)
	.get('/user', getCurrentUser);

module.exports = router;
