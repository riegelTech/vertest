'use strict';

const Path = require('path');

const ssh2Utils = require('ssh2').utils;

const appConfig = require('../appConfig/config');
const utils = require('../utils');

const ERR_CODES = {
	invalid_param: 'EINVALIDPARAM',
	duplicate_entry: 'EDUPLICATEENTRY',
	not_found: 'ENOTFOUND'
};

const privKeyPassSymbol = Symbol('privKeyPass');

class SshKey {
	constructor({name = '', pubKey = '', privKey = '', privKeyPass = ''}) {
		const err = new Error();

		if (!name) {
			err.message = 'SSH key config entry must have a valid name';
			err.code = ERR_CODES.invalid_param;
			throw err;
		}
		this.name = name;

		if (!pubKey) {
			err.message = 'SSH key config entry must have a valid public key';
			err.code = ERR_CODES.invalid_param;
			throw err;
		}
		this.pubKey = pubKey;
		this.privKey = privKey;

		this[privKeyPassSymbol] = privKeyPass;
		this.decryptedPrivKey = false;
	}

	async testFilesAccess() {
		try {
			await utils.access(this.pubKey);
		} catch (err) {
			throw new Error(`SSH key "${this.name}" : public key not found at ${this.pubKey}`);
		}
		if (!this.privKey) {
			return true;
		}
		try {
			await utils.access(this.privKey);
		} catch (err) {
			throw new Error(`SSH key "${this.name}" : private key not found at ${this.privKey}`);
		}
		return true;
	}

	async setPrivKeyPass(passPhrase) {
		const keyPath = Path.isAbsolute(this.privKey) ? this.privKey : Path.join(__dirname, '../', '../', this.privKey);
		const keyData = await utils.readFile(keyPath, 'utf8');

		const result = ssh2Utils.parseKey(keyData, passPhrase);
		if (result instanceof  Error) {
			if (result.message.includes('Bad passphrase')) {
				this.decryptedPrivKey = false;
				return false;
			}
			throw result;
		}

		this[privKeyPassSymbol] = passPhrase;
		this.decryptedPrivKey = true;
		return true;
	}

	get isDecrypted() {
		return this.decryptedPrivKey;
	}

	getPrivKeyPass() {
		return this[privKeyPassSymbol];
	}
}

const sshKeys = new Map();

async function initSshKeys() {
	const config = await appConfig.getAppConfig();

	if (!config.sshKeys) {
		return;
	}

	config.sshKeys.forEach(async sshKeyProps => {
		const sshKey = new SshKey(sshKeyProps);

		if (sshKeys.has(sshKey.name)) {
			const err = new Error(`SSH key with name "${sshKey.name}" already exists`);
			err.code = ERR_CODES.duplicate_entry;
			sshKeys.clear();
			throw err;
		}

		await sshKey.testFilesAccess();
		await sshKey.setPrivKeyPass(''); // automatically decrypt those that have no passphrase

		sshKeys.set(sshKey.name, sshKey);
	});
}

async function setPrivKeyPass(sshKeyName, passPhrase) {
	const sshKey = getSshKeyByName(sshKeyName);
	return await sshKey.setPrivKeyPass(passPhrase);
}


function getSshKeys() {
	return Array.from(sshKeys.values());
}

function getSshKeyByName(sshKeyName) {
	if (!sshKeys.has(sshKeyName)) {
		const err = new Error(`SSH key with name "${sshKeyName}" does not exist`);
		err.code = utils.RESPONSE_HTTP_CODES.ESSHKEYENOTFOUND;
		throw err;
	}
	return sshKeys.get(sshKeyName)
}

module.exports = {
	SshKey,
	initSshKeys,
	getSshKeys,
	getSshKeyByName,
	setPrivKeyPass
};