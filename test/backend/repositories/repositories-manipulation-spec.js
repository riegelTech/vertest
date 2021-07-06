'use strict';

const Path = require('path');

const chai = require('chai');
const fsExtra = require('fs-extra');
const NodeGit= require('nodegit');
const tmp = require('tmp-promise');
const uuid = require('uuidv4');

const sshGitServer = require('../testUtils/git/sshGitServer');
const httpGitServer = require('../testUtils/git/httpGitServer');
let repoModule = require('../../../app/repositories/repositories');
const {SshKey} = require('../../../app/sshKeys/ssh-keys');
const utils = require('../../../app/utils');

chai.should();
const expect = chai.expect;

describe('Repository module: GIT manipulations', function () {

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
		return gitRepository.createCommitOnHead([Path.join(fileDir ? fileDir : '', fileName)], signatures, signatures, commitMsg);
	}

	describe('move and remove repository', function () {
		let repoTestPath;
		beforeEach(async function () {
			repoTestPath = Path.join(tmpSpace.path, 'repoTests', uuid.uuid());
			await fsExtra.mkdirp(repoTestPath);
		});

		afterEach(async function () {
			await fsExtra.remove(repoTestPath);
		});

		it('should move a GIT repository from a directory to another', async function () {
			// given
			const newRepo = new repoModule.Repository({
				name: 'some name',
				address: repositoryPath,
				repoPath: repoTestPath
			});
			await newRepo.init({forceInit: true, waitForClone: true});
			const newRepoTestPath = Path.join(tmpSpace.path, 'repoTests', uuid.uuid());
			await fsExtra.mkdirp(newRepoTestPath);

			// when
			await newRepo.moveRepository(newRepoTestPath);
			// then
			(await fsExtra.pathExists(repoTestPath)).should.be.false;
			(await fsExtra.pathExists(newRepoTestPath)).should.be.true;

			// finally
			await fsExtra.remove(newRepoTestPath);
		});

		it('should throw error when destination directory doe not exist', async function () {
			// given
			const nonExistingDest = '/dev/null/does/not/exist';
			const newRepo = new repoModule.Repository({
				name: 'some name',
				address: repositoryPath,
				repoPath: repoTestPath
			});
			await newRepo.init({forceInit: true, waitForClone: true});

			// expect
			return newRepo.moveRepository(nonExistingDest).should.eventually.be.rejectedWith(`Directory ${nonExistingDest} does not exist`);
		});

		it('should remove a GIT repository', async function () {
			// given
			const newRepo = new repoModule.Repository({
				name: 'some name',
				address: repositoryPath,
				repoPath: repoTestPath
			});
			await newRepo.init({forceInit: true, waitForClone: true});

			// when
			await newRepo.remove();
			// then
			(await fsExtra.pathExists(repoTestPath)).should.be.false;
		});
	});

	describe('should manipulate GIT repository', function () {
		it('checkouting a branch', async function () {
			// given
			const newBranchName = 'some-new-branch';
			await addContentToTestRepository();
			const newRepo = new repoModule.Repository({
				name: 'some name',
				address: repositoryPath,
				repoPath: repositoryPath
			});
			await newRepo.init({forceInit: false, waitForClone: true});
			const oid = await addContentToTestRepository(null, 'otherTestFile', 'some other data', 'Some new commit');
			await gitRepository.createBranch(newBranchName, oid, false);
			newRepo.gitBranch.should.eql('master');
			// when
			await newRepo.checkoutBranch(newBranchName);
			// then
			newRepo.gitBranch.should.eql(newBranchName);
			(await gitRepository.getCurrentBranch()).name().should.contains(newBranchName);
		});

		it('checkouting a commit', async function () {
			// given
			await addContentToTestRepository();
			const newRepo = new repoModule.Repository({
				name: 'some name',
				address: repositoryPath,
				repoPath: repositoryPath
			});
			await newRepo.init({forceInit: false, waitForClone: true});
			const firstCommit = await gitRepository.getReferenceCommit('master');
			await addContentToTestRepository(null, 'otherTestFile', 'some other data', 'Some new commit');
			const newCommit = await gitRepository.getReferenceCommit(`master`);
			newCommit.sha().should.not.eql(firstCommit.sha());
			// when
			await newRepo.checkoutCommit(firstCommit.sha());
			// then
			const lastPretendingCommit = await gitRepository.getReferenceCommit(`master`);
			lastPretendingCommit.sha().should.eql(firstCommit.sha());
		});
	});
});