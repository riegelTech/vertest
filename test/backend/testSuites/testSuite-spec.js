'use strict';

const fs = require('fs');
const path = require('path');

const chai = require('chai');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const tmp = require('tmp-promise');

let testSuiteModule = require('../../../app/testSuites/testSuite');
const repositoryModule = require('../../../app/repositories/repositories');

chai.should();
chai.use(sinonChai);
const expect = chai.expect;

describe('Test Suites module', function () {

    let testSuitesColl = [];
    let findStub = sinon.stub().resolves({
        count: async () => testSuitesColl.length,
        toArray: () => testSuitesColl
    });
    let insertOneStub = sinon.stub().resolves(true);
    let updateStub = sinon.stub().resolves(true);
    let deleteStub = sinon.stub().resolves(true);

    function overrideTestSuiteModule() {
        insertOneStub.resetHistory();
        updateStub.resetHistory();
        deleteStub.resetHistory();
        findStub.resetHistory();
        testSuiteModule = proxyquire('../../../app/testSuites/testSuite', {
            '../db/db-connector': {
                DB_TABLES: {
                    TEST_SUITES: 'Some DB table'
                },
                getCollection: async () => ({
                    find: findStub,
                    insertOne: insertOneStub,
                    updateOne: updateStub,
                    deleteOne: deleteStub
                })
            }
        });
    }

    describe('Test suite class', function () {
        it('Should instanciate', () => {
            // given
            const repository = new repositoryModule.Repository({
                name: 'some new repository',
                address: 'https://some-repo-module.local',
                user: 'Some user',
                pass: 'Some path',
                repoPath: 'Some/repo/path'
            });
            // when
            const testSuite = new testSuiteModule.TestSuite({
                name: 'some new test suite',
                repository
            });
            // then
            testSuite.should.be.instanceOf(testSuiteModule.TestSuite);
        });
    });

    describe('Test suites collection', function () {

        beforeEach(function() {
            overrideTestSuiteModule();
        });

        it('Should fetch raw object from DB, whatever their format', async () => {
            // given
            testSuitesColl = [{
                name: 'Some test suite'
            }, {
                name: 'Some other test suite'
            }];
            // when
            const rawTestSuites = await testSuiteModule.fetchRawTestSuites();
            // then
            rawTestSuites.should.have.lengthOf(2);
            rawTestSuites.should.deep.eql(testSuitesColl);
        });

        it('Should get a collection of test suites instances', async () => {
            // given
            testSuitesColl = [{
                name: 'Some test suite',
                repository: {
                    name: 'some repository',
                    address: 'https://some-repo-module.local',
                    user: 'Some user',
                    pass: 'Some path',
                    _repoDir: 'Some/repo/path'
                }
            }, {
                name: 'Some other test suite',
                repository: {
                    name: 'some other repository',
                    address: 'https://some-other-repo-module.local',
                    user: 'Some user',
                    pass: 'Some path',
                    _repoDir: 'Some/other/repo/path'
                }
            }];
            // when
            const testSuites = await testSuiteModule.getTestSuites();
            findStub.should.have.been.calledOnce;
            // then
            testSuites.should.have.lengthOf(2);
            testSuites[0].should.be.instanceOf(testSuiteModule.TestSuite);
            testSuites[1].should.be.instanceOf(testSuiteModule.TestSuite);
            // when
            findStub.resetHistory();
            await testSuiteModule.getTestSuites();
            findStub.should.have.not.been.called;
        });

        it('Should get a test suite by its UUID, or throw an error', async () => {
            // given
            const testSuiteUuid = 'Some UUID';
            testSuitesColl = [{
                _id: testSuiteUuid,
                name: 'Some test suite',
                repository: {
                    name: 'some repository',
                    address: 'https://some-repo-module.local',
                    user: 'Some user',
                    pass: 'Some path',
                    _repoDir: 'Some/repo/path'
                }
            }];
            // when
            expect(() => testSuiteModule.getTestSuiteByUuid(testSuiteUuid)).to.throw(`No test suite found for UUID ${testSuiteUuid}`);
            // when
            await testSuiteModule.getTestSuites();
            const testSuite = testSuiteModule.getTestSuiteByUuid(testSuiteUuid);
            // then
            testSuite.should.be.instanceOf(testSuiteModule.TestSuite);
            const someNonExistingUUID = 'Some non existing UUID';
            expect(() => testSuiteModule.getTestSuiteByUuid(someNonExistingUUID)).to.throw(`No test suite found for UUID ${someNonExistingUUID}`);
        });

        it('Should add a test suite to existing collection', async () => {
            // given
            const testSuiteUuid = 'Some new test suite UUID';
            testSuitesColl = [];
            // when
            expect(() => testSuiteModule.getTestSuiteByUuid(testSuiteUuid)).to.throw(`No test suite found for UUID ${testSuiteUuid}`);
            const newTestSuite = new testSuiteModule.TestSuite({
                _id: testSuiteUuid,
                name: 'Some new test suite',
                repository: {
                    name: 'some repository',
                    address: 'https://some-repo-module.local',
                    user: 'Some user',
                    pass: 'Some path',
                    _repoDir: 'Some/repo/path'
                }
            });
            await testSuiteModule.addTestSuite(newTestSuite);
            // then
            insertOneStub.should.have.been.calledOnce;
            testSuiteModule.getTestSuiteByUuid(testSuiteUuid).should.instanceOf(testSuiteModule.TestSuite);
        });

        it('Should update existing test suite', async () => {
            // given
            const testSuiteUuid = 'Some UUID';
            const newTestSuiteName = 'Some modified test suite';
            testSuitesColl = [{
                _id: testSuiteUuid,
                name: 'Some test suite',
                repository: {
                    name: 'some repository',
                    address: 'https://some-repo-module.local',
                    user: 'Some user',
                    pass: 'Some path',
                    _repoDir: 'Some/repo/path'
                }
            }];
            // when
            const existingTestSuite = (await testSuiteModule.getTestSuites())[0];
            existingTestSuite.name = newTestSuiteName;
            // when
            await testSuiteModule.updateTestSuite(existingTestSuite);
            // then
            updateStub.should.have.been.calledOnce;
            const updatedTestSuite = testSuiteModule.getTestSuiteByUuid(testSuiteUuid);
            updatedTestSuite.name.should.eql(newTestSuiteName);
        });

        it('Should throw error when try to update a non existing test suite', async () => {
            // given
            testSuitesColl = [];
            // when
            const nonExistingUuid = 'Some unknown UUID';
            const nonExistingTestSuite = new testSuiteModule.TestSuite({
                _id: nonExistingUuid,
                name: 'Some unknown test suite',
                repository: {
                    name: 'some repository',
                    address: 'https://some-repo-module.local',
                    user: 'Some user',
                    pass: 'Some path',
                    _repoDir: 'Some/repo/path'
                }
            });
            // then
            await testSuiteModule.updateTestSuite(nonExistingTestSuite).should.eventually.be.rejectedWith(`No test suite found with id ${nonExistingUuid}`);
            // then
            updateStub.should.have.not.been.called;
        });

        it('Should delete a test suite', async () => {
            // given
            const testSuiteUuid = 'Some UUID';
            testSuitesColl = [{
                _id: testSuiteUuid,
                name: 'Some test suite',
                repository: {
                    name: 'some repository',
                    address: 'https://some-repo-module.local',
                    user: 'Some user',
                    pass: 'Some path',
                    _repoDir: 'Some/repo/path'
                }
            }];
            const existingTestSuite = (await testSuiteModule.getTestSuites())[0];
            // when
            await testSuiteModule.removeTestSuite(existingTestSuite);
            // then
            deleteStub.should.have.been.calledOnce;
            const testSuites = await testSuiteModule.getTestSuites();
            testSuites.should.have.lengthOf(0);
        });
    });

    describe('Test suite watcher', function () {

        let currentConfig = {};
        let clock;

        beforeEach(function () {
            clock = sinon.useFakeTimers({
                now: Date.now(),
                toFake: ['setInterval', 'Date'],
            });
            insertOneStub.resetHistory();
            updateStub.resetHistory();
            deleteStub.resetHistory();
            findStub.resetHistory();
            testSuiteModule = proxyquire('../../../app/testSuites/testSuite', {
                '../appConfig/config': {
                    getAppConfig: async () => currentConfig
                },
                '../db/db-connector': {
                    DB_TABLES: {
                        TEST_SUITES: 'Some DB table'
                    },
                    getCollection: async () => ({
                        find: findStub,
                        insertOne: insertOneStub,
                        updateOne: updateStub,
                        deleteOne: deleteStub
                    })
                }
            });
        });

        afterEach(function () {
            clock.restore();
        });

        it('Should regularly remove unused directories', async () => {
            // given
            const HOUR_MS = 60 * 60 * 1000;
            const tmpDir = await tmp.dir();
            currentConfig = {
                workspace: {
                    temporaryRepositoriesDir: tmpDir.path
                }
            };
            // when
            await fs.promises.mkdir(path.join(tmpDir.path, 'older-than-hour'));
            // then
            let remainingDirs = await fs.promises.readdir(tmpDir.path);
            remainingDirs.should.have.lengthOf(1);
            // when
            await clock.setSystemTime(Date.now() + HOUR_MS + 10);
            await testSuiteModule.cleanUnusedDirs();
            // then
            remainingDirs = await fs.promises.readdir(tmpDir.path);
            remainingDirs.should.have.lengthOf(0);
        });
    });
});