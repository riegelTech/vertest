'use strict';

const Path = require('path');

const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
const fsExtra = require('fs-extra');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const tmp = require('tmp-promise');
const uuid = require('uuidv4');
const winston = require('winston');

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

let logsModule;
let tmpSpace;

let mockedConfig = {
	workspace: {}
};
let configMock = {
	async getAppConfig() {
		return mockedConfig;
	}
};

describe('Logs module', function () {


	function instanciateLogsModuleWithMocks() {
		logsModule = proxyquire('../../../app/logsModule/logsModule.js', {
			'../appConfig/config': configMock
		});
	}

	before(async function() {
		tmpSpace = await tmp.dir();
		mockedConfig.workspace.logsDir = tmpSpace.path;
	});
	after(async function () {
		await fsExtra.remove(tmpSpace.path);
	});

	beforeEach(async function () {
		instanciateLogsModuleWithMocks();
		sinon.spy(winston, 'createLogger');
		sinon.spy(configMock, 'getAppConfig');
	});

	afterEach(function () {
		winston.createLogger.restore();
		configMock.getAppConfig.restore();
	});

	it('should initialize logs with levels info and error, and combined file', async function () {
		// when
		await logsModule.getDefaultLogger();
		// then
		await fsExtra.pathExists(Path.join(tmpSpace.path, 'info.log'));
		await fsExtra.pathExists(Path.join(tmpSpace.path, 'error.log'));
		await fsExtra.pathExists(Path.join(tmpSpace.path, 'combined.log'));
	});

	it('should not initialize logs twice', async function () {
		// when
		await logsModule.getDefaultLogger();
		// then
		configMock.getAppConfig.should.have.been.calledOnce;
		// when
		await logsModule.getDefaultLogger();
		// then
		configMock.getAppConfig.should.have.been.calledOnce;
	});

	it('should create a logger with console output if the configured logs directory does not exist', async function () {
		// given
		mockedConfig = {
			workspace: {
				logsDir: '/dev/null/logs/dir'
			}
		};
		// when
		await logsModule.getDefaultLogger();
		// then
		const transports = winston.createLogger.firstCall.firstArg.transports;
		transports.forEach(transport => {
			transport.constructor.should.be.eql(winston.transports.Console);
		});
	});

	it('should create a log file per test suite if does not exist', async function () {
		// given
		const testSuiteUuid = uuid.uuid();
		// when
		await logsModule.getTestSuiteLogger(testSuiteUuid);
		// then
		await fsExtra.pathExists(Path.join(tmpSpace.path, `${testSuiteUuid}.log`));
	});

	it('should not create a new logger each time a test suite logger is called', async function () {
		// given
		const testSuiteUuid = uuid.uuid();
		// when
		await logsModule.getTestSuiteLogger(testSuiteUuid);
		// then
		configMock.getAppConfig.should.have.been.calledOnce;
		// when
		await logsModule.getTestSuiteLogger(testSuiteUuid);
		// then
		configMock.getAppConfig.should.have.been.calledOnce;
	});

	it('should create a logger with console output for each test suite if the configured logs directory does not exist', async function () {
		// given
		mockedConfig = {
			workspace: {
				logsDir: '/dev/null/logs/dir'
			}
		};
		const testSuiteUuid = uuid.uuid();
		// when
		await logsModule.getTestSuiteLogger(testSuiteUuid);
		// then
		const transports = winston.createLogger.firstCall.firstArg.transports;
		transports.forEach(transport => {
			transport.constructor.should.be.eql(winston.transports.Console);
		});
	});
});
