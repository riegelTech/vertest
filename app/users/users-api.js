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

async function updateUser(req, res) {
	const userUuid = req.params.uuid;
	const userProps = _.pick(req.body, ['login', 'password', 'email', 'firstName', 'lastName']);
	userProps._id = userUuid;

	try {
		await usersModule.updateUser(userProps);
		return res.status(200).send('OK');
	} catch (e) {
		res.status(500);
		switch (e.code) {
			case 'EUSERNOTEDITABLE':
				res.status(403);
				break;
			case 'EUSERNOTFOUND':
				res.status(404);
				break;
			case 'EBADUSERDATA':
			default:
				res.status(400);
				break;
		}
		return res.send(e.message);
	}
}

router.get('/', async (req, res) => res.send(await usersModule.getUsers()))
	.post('/', createUser)
	.put('/:uuid', updateUser);

module.exports = router;