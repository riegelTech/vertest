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
         readFile(path, encoding) {
            if (errorConfigFileRead) {
               return Promise.reject(errorConfigFileRead);
            }
            return Promise.resolve(configFileContent);
         }
      };
      configModule = proxyquire('../../../app/appConfig/config', {
         '../utils': fsMock
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
      const expectedConfPath = Path.join(__dirname, '../', '../', '../', 'config.yml');
      // expect
      conf.should.eql(expectedParsedContent);
      fsMock.readFile.should.have.been.calledWith(expectedConfPath);
   });

   it('should read sample config file if main one is does not exists', async function () {
      // given
      fsMock.readFile.restore();
      sinon.stub(fsMock, 'readFile')
         .onFirstCall().callsFake((path, encoding) => {
            return Promise.reject(new Error('Some read error'));
         })
          .onSecondCall().callsFake((path, encoding) => {
            return Promise.resolve(configFileContent);
         });
      const expectedSampleConfPath = Path.join(__dirname, '../', '../', '../', 'config-sample.yml');
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
      configModule = proxyquire('../../../app/appConfig/config', {
         'fs': fsMock,
         'yaml': {
            parse() {
               throw new Error(parsingError);
            }
         }
      });

      return configModule.getAppConfig().should.be.rejectedWith(`Config file is not well formatted : ${parsingError}`);
   });

   it('should transform all paths that are included in workspace from relative to absolute paths', async function () {
      // given
      configFileContent = `workspace:
  some-absolute-path: /some/absolute/path
  some-relative-path: ./some/relative/path`;
      configModule = proxyquire('../../../app/appConfig/config', {
         '../utils': fsMock
      });
      const conf = await configModule.getAppConfig();
      const expectedConfPath = Path.join(__dirname, '../', '../', '../', 'config.yml');
      const expectedParsedContent = {
         'workspace': {
            'some-absolute-path': '/some/absolute/path',
            'some-relative-path': Path.join(Path.dirname(expectedConfPath), './some/relative/path')
         }
      };

      // expect
      conf.should.eql(expectedParsedContent);
   });
});