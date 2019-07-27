'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const usersModule = require('./users');

async function createUser(req, res) {
	try {
		const newUser = await usersModule.addUser(_.pick(req.body, ['login', 'pass', 'email', 'firstName', 'lastName']));
		res.send(newUser);
	} catch (e) {
		res.status(500).send(e.message);
	}
	
}

router.get('/', async (req, res) => res.send(await usersModule.getUsers()))
	.post('/', createUser)
	.put('/:uuid', updateUser)
	.delete('/:uuid', deleteUser);


module.exports = router;