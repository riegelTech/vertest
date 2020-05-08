'use strict';

const Path = require('path');

const chai = require('chai');
const fsExtra = require('fs-extra');
const NodeGit= require('nodegit');
const tmp = require('tmp-promise');
const uuid = require('uuidv4');

const gitServer = require('../testUtils/gitServer');
const repoModule = require('../../repositories/repositories');
const {SshKey} = require('../../sshKeys/ssh-keys');
const utils = require('../../utils');

chai.should();
const expect = chai.expect;

describe('Repository module', function () {
	describe('Repository class', async function () {

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

		async function addContentToTestRepository() {
			const folder = 'testDir';
			const fileToCommit = Path.join(repositoryPath, 'testFile');
			await utils.writeFile(fileToCommit, 'some data');
			await utils.mkdir(Path.join(repositoryPath, folder));
			const fileToCommit_2 = Path.join(repositoryPath, folder, 'testFile');
			await utils.writeFile(fileToCommit_2, 'other data');
			const signatures = await gitRepository.defaultSignature();
			await gitRepository.createCommitOnHead(['testFile', Path.join(folder, 'testFile')], signatures, signatures, 'New commit');
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
				await fsExtra.remove(repoTestPath);
				await fsExtra.mkdirp(repoTestPath);
			});

			it('should init an empty GIT repository', async function () {
				const newRepo = new repoModule.Repository({
					name: 'some name',
					address: repositoryPath,
					repoPath: repoTestPath
				});
				await newRepo.init({forceInit: true, waitForClone: true});
				expect(newRepo.commit).to.be.null;
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

				newRepo.commit.should.not.be.null;
				newRepo.gitBranch.should.eql('master');
				newRepo.gitBranches.should.eql(['master']);
			});

			describe('Authentication', function () {

				let gitServerPort;

				beforeEach(async function () {
					gitServerPort = await gitServer.createSshServer({
						debug: true,
						gitRepository,
						allowedUser: 'foo',
						allowedPassword: 'foobar',
						allowedPubKeyPath: Path.resolve(__dirname, '../fixtures/unprotectedClientSshKey.pub'),
						sshServerKey: Path.resolve(__dirname, '../fixtures/falseGitServerSshKey')
					})
				});

				afterEach(async function () {
					return gitServer.tearDownSshServer();
				});

				it.only('should clone remote GIT repository with SSH keyring that have been decrypted', async function () {
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
					await newRepo.init({forceInit: true, waitForClone: true});
				});

				it('should not clone remote GIT repository with SSH keyring that have an encrypted private key', async function () {

				});

			});

			it('should clone a remote GIT repository using HTTP credentials', async function () {

			});

			it('should clone a remote GIT repository using SSH keyring with a decrypted private key', async function () {

			});


			it('should throw error with bad SSH key or bad HTTP credentials', function () {

			});

			it('should throw error with bad GIT repository address', function () {

			});
		});
	});
});