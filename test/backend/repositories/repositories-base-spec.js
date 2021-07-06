'use strict';

const Path = require('path');

const chai = require('chai');
const fsExtra = require('fs-extra');
const NodeGit= require('nodegit');
const tmp = require('tmp-promise');
const uuid = require('uuidv4');

let repoModule = require('../../../app/repositories/repositories');
const {SshKey} = require('../../../app/sshKeys/ssh-keys');
const utils = require('../../../app/utils');

chai.should();
const expect = chai.expect;

describe('Repository module: base tests', function () {

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


	it('Should instantiate a Repository', function () {
		return new repoModule.Repository({
			name: 'some name',
			address: repositoryPath,
			repoPath: repositoryPath
		});
	});

	describe('Should raise an error at instantiation', function () {
		it('When repository name is missing', function () {
			expect(() => new repoModule.Repository({
				address: repositoryPath,
				repoPath: repositoryPath
			})).to.throw('Repository name is mandatory : "" given.');
		});

		it('When repository path is missing', function () {
			expect(() => new repoModule.Repository({
				name: 'some name',
				address: repositoryPath
			})).to.throw('Repository path is mandatory : "" given.');
		});

		it('When repository ssh key and pass are both defined', async function () {
			const decryptedSshKey = new SshKey({
				name: 'foo',
				pubKey: Path.resolve(__dirname, '../fixtures/unprotectedClientSshKey.pub'),
				privKey: Path.resolve(__dirname, '../fixtures/unprotectedClientSshKey')
			});
			decryptedSshKey.setPrivKeyPass('');
			expect(() => new repoModule.Repository({
				name: 'some name',
				address: repositoryPath,
				repoPath: repositoryPath,
				sshKey: decryptedSshKey,
				user: 'foo',
				pass: 'bar'
			})).to.throw('Cannot use both ssh and http authentication.');
		});
	});
});