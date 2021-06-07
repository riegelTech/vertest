'use strict';

const Path = require('path');

const chai = require('chai');
const dataDriven = require('data-driven');
const fsExtra = require('fs-extra');
const NodeGit= require('nodegit');
const tmp = require('tmp-promise');
const uuid = require('uuidv4');

const sshGitServer = require('../testUtils/git/sshGitServer');
const httpGitServer = require('../testUtils/git/httpGitServer');
const repoModule = require('../../../app/repositories/repositories');
const {SshKey} = require('../../../app/sshKeys/ssh-keys');
const utils = require('../../../app/utils');

chai.should();
const expect = chai.expect;

describe('Repository module', function () {
	describe('Repository class', function () {

		let tmpSpace;
		let gitRepository;
		let repositoryPath;
		before(async function() {
			tmpSpace = await tmp.dir();
			repositoryPath = Path.join(tmpSpace.path, uuid.uuid());
		});
		after(async function () {
			await fsExtra.remove(tmpSpace.path);
		});

		beforeEach(async function () {
			await fsExtra.remove(repositoryPath);
			gitRepository = await NodeGit.Repository.init(repositoryPath, 0);
			await NodeGit.Repository.open(repositoryPath);
		});

		async function addContentToTestRepository(fileDir = null, fileName = 'testFile', fileContent = 'some data', commitMsg = 'Some new commit') {
			const dir = fileDir ? Path.join(repositoryPath, fileDir) : repositoryPath;
			const file = Path.join(dir, fileName);
			if (fileDir) {
				await fsExtra.mkdirp(dir);
			}

			await utils.writeFile(file, fileContent);
			const signatures = await gitRepository.defaultSignature();
			await gitRepository.createCommitOnHead([Path.join(fileDir ? fileDir : '', fileName)], signatures, signatures, commitMsg);
		}


		it('Should instantiate a Repository', function () {
			return new repoModule.Repository({
				name: 'some name',
				address: repositoryPath,
				repoPath: repositoryPath
			});
		});

		describe('Repository initialization', function () {

			let repoTestPath;
			beforeEach(async function () {
				repoTestPath = Path.join(tmpSpace.path, 'repoTests', uuid.uuid());
				await fsExtra.mkdirp(repoTestPath);
			});

			afterEach(async function () {
				await fsExtra.remove(repoTestPath);
			});

			it('should init an empty GIT repository', async function () {
				const newRepo = new repoModule.Repository({
					name: 'some name',
					address: repositoryPath,
					repoPath: repoTestPath
				});
				await newRepo.init({forceInit: true, waitForClone: true});
				expect(newRepo.commitSha).to.be.null;
				expect(newRepo.gitBranch).to.be.null;
			});

			it('should init a non-empty GIT repository and get current commit and branches', async function () {
				// given
				await addContentToTestRepository();
				// when
				const newRepo = new repoModule.Repository({
					name: 'some name',
					address: repositoryPath,
					repoPath: repoTestPath
				});
				await newRepo.init({forceInit: true, waitForClone: true});

				newRepo.commitSha.should.not.be.null;
				newRepo.gitBranch.should.eql('master');
				newRepo.gitBranches.should.eql(['master']);
			});

			describe('Authentication', function () {

				describe('with SSH server, using SSH keyring', function () {

					let gitServerPort;

					beforeEach(async function () {
						gitServerPort = await sshGitServer.createSshServer({
							gitRepository,
							allowedUser: 'foo',
							allowedPassword: 'foobar',
							allowedPubKeyPath: Path.resolve(__dirname, '../fixtures/unprotectedClientSshKey.pub'),
							sshServerKey: Path.resolve(__dirname, '../fixtures/falseGitServerSshKey')
						});
					});

					afterEach(async function () {
						return sshGitServer.tearDownSshServer();
					});

					it('should clone remote GIT repository with SSH keyring without passphrase', async function () {
						// given
						await addContentToTestRepository();
						const gitRespositorySshAddress = `ssh://foo@localhost:${gitServerPort}/test.git`;
						const decryptedSshKey = new SshKey({
							name: 'foo',
							pubKey: Path.resolve(__dirname, '../fixtures/unprotectedClientSshKey.pub'),
							privKey: Path.resolve(__dirname, '../fixtures/unprotectedClientSshKey')
						});
						await decryptedSshKey.setPrivKeyPass('');
						// when
						const newRepo = new repoModule.Repository({
							name: 'some name',
							address: gitRespositorySshAddress,
							repoPath: repoTestPath,
							sshKey: decryptedSshKey,
							user: 'foo'
						});
						return newRepo.init({forceInit: true, waitForClone: true});
					});

					it('should fail to clone remote GIT repository with bad SSH key', async function () {
						// given
						await addContentToTestRepository();
						const gitRespositorySshAddress = `ssh://foo@localhost:${gitServerPort}/test.git`;
						const decryptedSshKey = new SshKey({
							name: 'foo',
							pubKey: Path.resolve(__dirname, '../fixtures/protectedClientSshKey.pub'),
							privKey: Path.resolve(__dirname, '../fixtures/protectedClientSshKey')
						});
						await decryptedSshKey.setPrivKeyPass('foobar');
						// when
						const newRepo = new repoModule.Repository({
							name: 'some name',
							address: gitRespositorySshAddress,
							repoPath: repoTestPath,
							sshKey: decryptedSshKey,
							user: 'foo'
						});
						return newRepo.init({forceInit: true, waitForClone: true}).should.eventually.be.rejectedWith(`Failed to clone repository ${gitRespositorySshAddress}, please check your credentials`);
					});
				});

				describe('With SSH server using protected ssh private keys', function () {

					let gitServerPort;

					beforeEach(async function () {
						gitServerPort = await sshGitServer.createSshServer({
							gitRepository,
							allowedUser: 'foo',
							allowedPassword: 'foobar',
							allowedPubKeyPath: Path.resolve(__dirname, '../fixtures/protectedClientSshKey.pub'),
							sshServerKey: Path.resolve(__dirname, '../fixtures/falseGitServerSshKey')
						});
					});

					afterEach(async function () {
						return sshGitServer.tearDownSshServer();
					});

					it('should not clone remote GIT repository with SSH keyring that have a protected private key', async function () {
						// given
						await addContentToTestRepository();
						const gitRespositorySshAddress = `ssh://foo@localhost:${gitServerPort}/test.git`;
						const decryptedSshKey = new SshKey({
							name: 'foo',
							pubKey: Path.resolve(__dirname, '../fixtures/protectedClientSshKey.pub'),
							privKey: Path.resolve(__dirname, '../fixtures/protectedClientSshKey')
						});
						await decryptedSshKey.setPrivKeyPass('bad pass phrase');
						// when
						const newRepo = new repoModule.Repository({
							name: 'some name',
							address: gitRespositorySshAddress,
							repoPath: repoTestPath,
							sshKey: decryptedSshKey,
							user: 'foo'
						});

						return newRepo.init({forceInit: true, waitForClone: true}).should.eventually.be.rejectedWith(`Private key is encrypted for repository "some name", please decrypt it`);
					});

					it('should clone remote GIT repository with SSH keyring that have a protected and decrypted private key', async function () {
						// given
						await addContentToTestRepository();
						const gitRespositorySshAddress = `ssh://foo@localhost:${gitServerPort}/test.git`;
						const decryptedSshKey = new SshKey({
							name: 'foo',
							pubKey: Path.resolve(__dirname, '../fixtures/protectedClientSshKey.pub'),
							privKey: Path.resolve(__dirname, '../fixtures/protectedClientSshKey')
						});
						await decryptedSshKey.setPrivKeyPass('foobar');
						// when
						const newRepo = new repoModule.Repository({
							name: 'some name',
							address: gitRespositorySshAddress,
							repoPath: repoTestPath,
							sshKey: decryptedSshKey,
							user: 'foo'
						});
						// then
						return newRepo.init({forceInit: true, waitForClone: true});
					});
				});
			});

			describe('should clone a remote GIT repository using HTTP credentials', function () {

				let serverPort;

				beforeEach(async function () {
					serverPort = (await httpGitServer.createHttpServer({
						gitRepository,
						allowedUser: 'foo',
						allowedPassword: 'bar'
					})).port;
				});

				afterEach(async function () {
					return httpGitServer.tearDownHttpServer();
				});

				it('with regular user / password', async function () {
					// given
					await addContentToTestRepository();
					const gitRespositoryHttpAddress = `http://foo@localhost:${serverPort}/test.git`;
					// when
					const newRepo = new repoModule.Repository({
						name: 'some name',
						address: gitRespositoryHttpAddress,
						repoPath: repoTestPath,
						user: 'foo',
						pass: 'bar'
					});
					return newRepo.init({forceInit: true, waitForClone: true});
				});

				it('with bad user / password', async function () {
					// given
					await addContentToTestRepository();
					const gitRespositoryHttpAddress = `http://foo@localhost:${serverPort}/test.git`;
					// when
					const newRepo = new repoModule.Repository({
						name: 'some name',
						address: gitRespositoryHttpAddress,
						repoPath: repoTestPath,
						user: 'foo',
						pass: 'wrongPassword'
					});
					return newRepo.init({forceInit: true, waitForClone: true}).should.eventually.be.rejectedWith(`Failed to clone repository ${gitRespositoryHttpAddress}, please check your credentials`);
				});

				it('should return explicit Clone error message when authentication succeeds but clone fails', async function () {
					// given
					httpGitServer.corruptGitServer();
					await addContentToTestRepository();
					const gitRespositoryHttpAddress = `http://foo@localhost:${serverPort}/test.git`;
					// when
					const newRepo = new repoModule.Repository({
						name: 'some name',
						address: gitRespositoryHttpAddress,
						repoPath: repoTestPath,
						user: 'foo',
						pass: 'bar'
					});
					await newRepo.init({forceInit: true, waitForClone: true}).should.eventually.be.rejectedWith(`Failed to clone repository ${gitRespositoryHttpAddress}: wrong pack signature`);
					httpGitServer.decorruptGitServer();
				});

				it('with no password required (public repository)', async function () {
					// given
					await httpGitServer.tearDownHttpServer();
					serverPort = (await httpGitServer.createHttpServer({
						gitRepository
					})).port;
					await addContentToTestRepository();
					const gitRespositoryHttpAddress = `http://foo@localhost:${serverPort}/test.git`;
					// when
					const newRepo = new repoModule.Repository({
						name: 'some name',
						address: gitRespositoryHttpAddress,
						repoPath: repoTestPath
					});
					return newRepo.init({forceInit: true, waitForClone: true});
				});

			});

			it('should throw error with bad GIT repository address', function () {

			});
		});

		describe('refresh repository infos', function () {

			let repoTestPath;
			beforeEach(async function () {
				repoTestPath = Path.join(tmpSpace.path, 'repoTests', uuid.uuid());
				await fsExtra.mkdirp(repoTestPath);
			});

			afterEach(async function () {
				await fsExtra.remove(repoTestPath);
			});

			it('should refresh last commit sha', async function () {
				// given
				await addContentToTestRepository();
				// when
				const newRepo = new repoModule.Repository({
					name: 'some name',
					address: repositoryPath,
					repoPath: repoTestPath
				});
				const currentBranch = 'master';
				await newRepo.init({forceInit: true, waitForClone: true});
				const lastCommit = await newRepo.getRecentCommitOfBranch(currentBranch);
				// when
				await addContentToTestRepository(null, 'otherTestFile', 'some other data', 'Some new commit');
				(await newRepo.getRecentCommitOfBranch('master')).should.eql(lastCommit);
				// and
				await newRepo.fetchRepository();
				// then
				(await newRepo.getRecentCommitOfBranch('master')).should.not.eql(lastCommit);
			});

			describe('should detect or not changes in repository', function () {

				dataDriven([{
					msg: 'successfully with file addition',
					initialCommit: {
					},
					addition: {
						dir: 'someDirectory',
						file: 'someDirectory/someNewFile.test',
						fileContent: 'Some new file content'
					},
					deletion: {
						file: null
					},
					detectionFilter: '**/someDirectory/**.test',
					detection: true
				}, {
					msg: 'successfully with file deletion',
					initialCommit: {
						dir: 'someDirectory',
						file: 'someNewFile.test',
						fileContent: 'Some file content'
					},
					addition: {},
					deletion: {
						file: 'someDirectory/someNewFile.test'
					},
					detectionFilter: '**/someDirectory/**.test',
					detection: true
				}, {
					msg: 'successfully with file modification',
					initialCommit: {
						dir: 'someDirectory',
						file: 'someNewFile.test',
						fileContent: 'Some file content'
					},
					addition: {
						dir: 'someDirectory',
						file: 'someDirectory/someNewFile.test',
						fileContent: 'Some new file content'
					},
					deletion: {
						file: null
					},
					detectionFilter: '**/someDirectory/**.test',
					detection: true
				}, {
					msg: 'no detection without test file matching',
					initialCommit: {
						dir: 'someDirectory',
						file: 'someNewFile.test',
						fileContent: 'Some file content'
					},
					addition: {
						dir: 'someDirectory',
						file: 'someDirectory/someNewFile.test',
						fileContent: 'Some new file content'
					},
					deletion: {
						file: null
					},
					detectionFilter: '**/nonExistantDirectory/**.test',
					detection: false
				}, {
					msg: 'no detection without modification',
					initialCommit: {
						dir: 'someDirectory',
						file: 'someNewFile.test',
						fileContent: 'Some file content'
					},
					addition: {},
					deletion: {},
					detectionFilter: '**/nonExistantDirectory/**.test',
					detection: false
				}], () => {
					it('{msg}', async function (ctx) {
						// given
						await addContentToTestRepository(ctx.initialCommit.dir, ctx.initialCommit.file, ctx.initialCommit.fileContent);
						const newRepo = new repoModule.Repository({
							name: 'some name',
							address: repositoryPath,
							repoPath: repoTestPath
						});
						await newRepo.init({forceInit: true, waitForClone: true});
						// when
						const signatures = await gitRepository.defaultSignature();
						if (ctx.addition.dir) {
							await fsExtra.mkdirp(Path.join(repositoryPath, ctx.addition.dir));
						}
						if (ctx.addition.file) {
							await utils.writeFile(Path.join(repositoryPath, ctx.addition.file), ctx.addition.fileContent || '');
							await gitRepository.createCommitOnHead([ctx.addition.file], signatures, signatures, 'Some commit');
						}
						const curRepoIndex = await gitRepository.refreshIndex();
						if (ctx.deletion.file) {
							curRepoIndex.removeByPath(ctx.deletion.file);
							await curRepoIndex.write();
							const oid = await curRepoIndex.writeTree();
							const head = await NodeGit.Reference.nameToId(gitRepository, "HEAD");
							const parent = await gitRepository.getCommit(head);
							await gitRepository.createCommit("HEAD", signatures, signatures, 'Some deletion commit', oid, [parent]);
						}
						// and
						await newRepo.fetchRepository();
						// then
						const detectedChanges = await newRepo.lookupForChanges([ctx.detectionFilter]);
						detectedChanges.should.eql(ctx.detection);
					});
				});
			});

		});
	});
});