'use strict';

const Path = require('path');

const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('appConfig', function () {

   let configModule;
   let configFileContent;
   let errorConfigFileRead;
   let fsMock;

   beforeEach(function () {
      configFileContent = `some-list:
  some-item: some-value`;
      errorConfigFileRead = null;
      fsMock = {
         readFile(path, encoding, cb) {
            cb(errorConfigFileRead, configFileContent);
         }
      };
      configModule = proxyquire('./config', {
         'fs': fsMock
      });

      sinon.spy(fsMock, 'readFile');
   });

   afterEach(function () {
      fsMock.readFile.restore();
   });

   it('should load and read yaml config file', async function () {
      // given
      const conf = await configModule.getAppConfig();
      const expectedParsedContent = {
         'some-list': {
            'some-item': 'some-value'
         }
      };
      const expectedConfPath = Path.join(__dirname, '../', '../', 'config.yml');
      // expect
      conf.should.eql(expectedParsedContent);
      fsMock.readFile.should.have.been.calledWith(expectedConfPath);
   });

   it('should read sample config file if main one is does not exists', async function () {
      // given
      fsMock.readFile.restore();
      sinon.stub(fsMock, 'readFile')
         .onFirstCall().callsFake((path, encoding, cb) => {
            cb(new Error('Some read error'), null);
         })
          .onSecondCall().callsFake((path, encoding, cb) => {
         cb(null, configFileContent);
      });
      const expectedSampleConfPath = Path.join(__dirname, '../', '../', 'config-sample.yml');
      // when
      await configModule.getAppConfig();
      fsMock.readFile.should.have.been.calledTwice;
      fsMock.readFile.should.have.been.calledWith(expectedSampleConfPath);
      fsMock.readFile.reset();
   });

   it('should persist config after first read', async function () {
      // given
      const conf = await configModule.getAppConfig();
      // when
      const secondConfCall = await configModule.getAppConfig();
      // then
      fsMock.readFile.should.have.been.calledOnce;
      conf.should.eql(secondConfCall);
   });

   it('should fail if none of sample and main config file exists', async function () {
      // given
      errorConfigFileRead = new Error('Some file read error');
      // expect
      return configModule.getAppConfig().should.be.rejectedWith(`Config file does not exist or is not readable : ${errorConfigFileRead.message}`);
   });

   it('should fail if yaml parsing fails', async function () {
      // given
      const parsingError = 'Some parsing error';
      configModule = proxyquire('./config', {
         'fs': fsMock,
         'yaml': {
            parse() {
               throw new Error(parsingError);
            }
         }
      });

      return configModule.getAppConfig().should.be.rejectedWith(`Config file is not well formatted : ${parsingError}`);
   });
});