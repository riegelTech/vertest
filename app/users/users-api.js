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

router.get('/', async (req, res) => res.send(await usersModule.getUsers()))
	.post('/', createUser);

module.exports = router;