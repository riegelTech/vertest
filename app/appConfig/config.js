'use strict';

const path = require('path');

const _ = require('lodash');
const Yaml = require('yaml');

const utils = require('../utils');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.yml');
const CONFIG_SAMPLE_PATH = path.join(__dirname, '..', '..', 'config-sample.yml');

let config;

async function getAppConfigFileContent() {
	let configFileContent;
	let configFilePath = CONFIG_PATH;
	try {
		configFileContent = await utils.readFile(CONFIG_PATH, 'utf8');
	} catch (errorConfig) {
		try {
			configFileContent = await utils.readFile(CONFIG_SAMPLE_PATH, 'utf8');
			configFilePath = CONFIG_SAMPLE_PATH;
			// TODO should emit a warning log
		} catch (errorSample) {
			throw new Error(`Config file does not exist or is not readable : ${errorSample.message}`);
		}
	}

	try {
		config = Yaml.parse(configFileContent);
	} catch (e) {
		throw new Error(`Config file is not well formatted : ${e.message}`);
	}

	_.forEach(config.workspace, (dirPath, key) => {
		config.workspace[key] = path.resolve(path.dirname(CONFIG_SAMPLE_PATH), dirPath);
	});

	return config;
}

async function getAppConfig() {
	return config ? config : await getAppConfigFileContent();
}

module.exports = {
	getAppConfig
};