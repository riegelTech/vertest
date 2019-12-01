'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const usersModule = require('./users');
const {getHttpCode} = require('../utils');

async function createUser(req, res) {
	try {
		const newUser = await usersModule.addUser(_.pick(req.body, ['login', 'password', 'email', 'firstName', 'lastName', 'readOnly']));
		res.send(newUser);
	} catch (e) {
		res.status(getHttpCode(e.code));
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
		res.status(getHttpCode(e.code));
		return res.send(e.message);
	}
}

async function deleteUser(req, res) {
	const userUuid = req.params.uuid;
	try {
		await usersModule.deleteUser(userUuid);
		return res.status(200).send('OK');
	} catch (e) {
		res.status(getHttpCode(e.code));
		return res.send(e.message);
	}
}

router.get('/', async (req, res) => res.send(await usersModule.getUsers()))
	.post('/', createUser)
	.put('/:uuid', updateUser)
	.delete('/:uuid', deleteUser);

module.exports = router;