'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

const Yaml = require('yaml');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.yml');
const CONFIG_SAMPLE_PATH = path.join(__dirname, '..', '..', 'config-sample.yml');

let config;

async function getAppConfigFileContent() {

	// TODO use utils module instead
	const readFile = util.promisify(fs.readFile);

	let configFileContent;
	try {
		configFileContent = await readFile(CONFIG_PATH, 'utf8');
	} catch (errorConfig) {
		try {
			configFileContent = await readFile(CONFIG_SAMPLE_PATH, 'utf8');
			// TODO should emit a warning log
		} catch (errorSample) {
			throw new Error(`Config file does not exist or is not readable : ${errorSample.message}`);
		}
	}

	try {
		config = Yaml.parse(configFileContent);
		return config;
	} catch (e) {
		throw new Error(`Config file is not well formatted : ${e.message}`);
	}
}

async function getAppConfig() {
	return config ? config : await getAppConfigFileContent();
}

module.exports = {
	getAppConfig,
	async getConfigRepositories() {
		const config = await getAppConfig();
		if (!config.repositories) {
			const err = new Error('Your configuration does not contains any repository');
			err.code = 'EEMPTYCONFIGURATION';
			throw err;
		}
		return config.repositories;
	}
};