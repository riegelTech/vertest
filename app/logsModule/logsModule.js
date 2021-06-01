'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const winston = require('winston');

const config = require('../appConfig/config');


let defaultLogger = null;
let loggers = new Map();

const defaultFormat = winston.format.combine(
	winston.format.timestamp(),
	winston.format.json()
);

async function getDefaultLogger() {
	if (defaultLogger) {
		return defaultLogger;
	}

	const appConfig = await config.getAppConfig();

	try {
		await fsp.access(appConfig.workspace.logsDir, fs.constants.W_OK);
		defaultLogger = winston.createLogger({
			format: defaultFormat,
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

async function getTestSuiteLogger (testSuiteId) {
	if (loggers.has(testSuiteId)) {
		return loggers.get(testSuiteId);
	}

	const appConfig = await config.getAppConfig();

	let idLogger;
	try {
		await fsp.access(appConfig.workspace.logsDir, fs.constants.W_OK);
		idLogger = winston.createLogger({
			levels: {
				[`test-suite-${testSuiteId}`]: 2,
				info: 2
			},
			format: defaultFormat,
			transports: [
				new winston.transports.File({ filename: path.join(appConfig.workspace.logsDir, `${testSuiteId}.log`), level: `test-suite-${testSuiteId}`}),
				new winston.transports.File({ filename: path.join(appConfig.workspace.logsDir, 'info.log'), level: 'info' })
			]
		});
	} catch (e) {
		idLogger = winston.createLogger({
			format: winston.format.simple(),
			transports: [
				new winston.transports.Console({level: 'info'}),
				new winston.transports.Console({level: 'error'})
			]
		});
	}

	loggers.set(testSuiteId, idLogger);

	return idLogger;
}

async function auditLogForTestSuite(testSuiteId, user, message, testFilePath) {
	const logger = await getTestSuiteLogger(testSuiteId);

	const logObject = {
		message,
		userId: user._id,
		userLogin: user.login,
		userFirstName: user.firstName,
		userLastName: user.lastName
	};
	if (testFilePath) {
		logObject.testFilePath = testFilePath;
	}
	return logger.log(`test-suite-${testSuiteId}`, logObject);
}

async function readTestSuiteLogs(testSuiteId, start = 0, limit = 10) {
	if (!loggers.has(testSuiteId)) {
		throw new Error(`No logger exists for test suite "${testSuiteId}"`);
	}
	const testSuiteLogger = loggers.get(testSuiteId);
	const options = {
		from: new Date(0),
		level: `test-suite-${testSuiteId}`,
		start,
		limit,
		order: 'desc'
	};
	return new Promise((res, rej) => {
		testSuiteLogger.query(options, (err, result) => {
			if (err) {
				return rej(err);
			}
			return res(result.file);
		});
	});
}

module.exports = {
	getDefaultLogger,
	getDefaultLoggerSync,
	getTestSuiteLogger,
	auditLogForTestSuite,
	readTestSuiteLogs
};
