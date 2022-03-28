'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const Path = require('path');

const logs = require('../logsModule/logsModule').getDefaultLoggerSync();
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
	constructor({name = '', pubKey = '', privKey = '', privKeyPass = ''}, setPrivKeyPass = true) {
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

		if (setPrivKeyPass) {
			this.setPrivKeyPass(privKeyPass);
		}
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

	setPrivKeyPass(passPhrase) {
		const keyPath = Path.isAbsolute(this.privKey) ? this.privKey : Path.join(__dirname, '../', '../', this.privKey);
		const keyData = fs.readFileSync(keyPath, 'utf8');
		let result;
		try {
			result = ssh2Utils.parseKey(keyData, passPhrase);
		} catch (e) {
			result = e;
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
const sshKeyCollectionEventEmitter = new EventEmitter();

async function initSshKeys() {
	const config = await appConfig.getAppConfig();

	if (!config.sshKeys) {
		return;
	}

	config.sshKeys.forEach(async sshKeyProps => {
		const sshKey = new SshKey(sshKeyProps, false);

		if (sshKeys.has(sshKey.name)) {
			const err = new Error(`SSH key with name "${sshKey.name}" already exists`);
			err.code = ERR_CODES.duplicate_entry;
			sshKeys.clear();
			throw err;
		}
		try {
			await sshKey.testFilesAccess();
			sshKeys.set(sshKey.name, sshKey);
			setPrivKeyPass(sshKey.name,''); // automatically decrypt those that have no passphrase
		} catch (e) {
			logs.error({message: e.message});
		}
	});
}

function setPrivKeyPass(sshKeyName, passPhrase) {
	const sshKey = getSshKeyByName(sshKeyName);
	const success = sshKey.setPrivKeyPass(passPhrase);
	if (success) {
		sshKeyCollectionEventEmitter.emit('sshKeyDecrypted', sshKey);
	}
	return success;
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
	sshKeyCollectionEventEmitter,
	initSshKeys,
	getSshKeys,
	getSshKeyByName,
	setPrivKeyPass
};
