'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const usersModule = require('./users');

async function createUser(req, res) {
	try {
		const newUser = await usersModule.addUser(_.pick(req.body, ['login', 'pass', 'email', 'firstName', 'lastName', 'readOnly']));
		res.send(newUser);
	} catch (e) {
		res.status(500);
		if (e.code === 'EUSEREXISTS') {
			res.status(409);
		}
		res.send(e.message);
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
	const currentUser = usersModule.getCurrentUser();
	return res.status(200).send(currentUser);
}

router.get('/', async (req, res) => res.send(await usersModule.getUsers()))
	.post('/init/', initSuperAdmin)
	.post('/', createUser)
	.get('/currentUser/', getCurrentUser)
	// .put('/:uuid', updateUser)
	// .delete('/:uuid', deleteUser);


module.exports = router;