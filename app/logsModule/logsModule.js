'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const winston = require('winston');

const config = require('../appConfig/config');


let defaultLogger = null;

async function getDefaultLogger() {
	if (defaultLogger) {
		return defaultLogger;
	}

	const appConfig = await config.getAppConfig();

	try {
		await fsp.access(appConfig.workspace.logsDir, fs.constants.W_OK);
		defaultLogger = winston.createLogger({
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.json()
			),
			transports: [
				new winston.transports.File({ filename: path.join(appConfig.workspace.logsDir, 'info.log'), level: 'info' }),
				new winston.transports.File({ filename: path.join(appConfig.workspace.logsDir, 'error.log'), level: 'error' }),
				new winston.transports.File({ filename: path.join(appConfig.workspace.logsDir, 'combined.log') })
			]
		});
	} catch (e){
		defaultLogger = winston.createLogger({
			format: winston.format.simple(),
			transports: [
				new winston.transports.Console({level: 'info'}),
				new winston.transports.Console({level: 'error'})
			]
		});
	}

	return defaultLogger;
}

function getDefaultLoggerSync() {
	return defaultLogger;
}

module.exports = {
	getDefaultLogger,
	getDefaultLoggerSync
};
