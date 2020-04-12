'use strict';

const express = require('express');
const router = express.Router();

const sshKeysModule = require('./ssh-keys');
const utils = require('../utils');

function getSSHKeys(req, res) {
	return res.status(200).send(sshKeysModule.getSshKeys());
}

async function setPrivKeyPass(req, res) {
	const passPhrase = req.body.keyPass;
	const sshKeyName = req.params.keyname;

	let success;
	try {
		success = await sshKeysModule.setPrivKeyPass(sshKeyName, passPhrase);
		if (success) {
			return res.status(200).send('ok');
		}
		return res.status(200).send('nok');
	} catch (e) {
		const errCode = utils.RESPONSE_HTTP_CODES[e.code] || utils.RESPONSE_HTTP_CODES.DEFAULT;
		return res.status(errCode).send(e.message);
	}
}


router.get('/', getSSHKeys)
	.post('/:keyname/key-pass', setPrivKeyPass);

module.exports = router;