'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

const Yaml = require('yaml');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.yml');
const CONFIG_SAMPLE_PATH = path.join(__dirname, '..', '..', 'config-sample.yml');

async function getAppConfigFileContent() {

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
		return Yaml.parse(configFileContent);
	} catch (e) {
		throw new Error(`Config file is not well formatted : ${e.message}`);
	}
}

module.exports = {
	getAppConfigFileContent
};