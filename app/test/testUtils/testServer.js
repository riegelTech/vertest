'use strict';

const Path = require('path');

const NodeGit = require('nodegit');
const tmp = require('tmp-promise');
const uuid = require('uuidv4');

const gitServer = require('./gitServer');
const utils = require('../../utils');

async function setup() {
	const tmpSpace = await tmp.dir();
	const repositoryPath = Path.join(tmpSpace.path, uuid.uuid());

	const gitRepository = await NodeGit.Repository.init(repositoryPath, 0);
	await NodeGit.Repository.open(repositoryPath);

	const fileToCommit = Path.join(repositoryPath, 'testFile');
	await utils.writeFile(fileToCommit, 'some data');
	const signatures = await gitRepository.defaultSignature();
	await gitRepository.createCommitOnHead(['testFile'], signatures, signatures, 'New commit');

	const port = await gitServer.createSshServer({
		debug: true,
		gitRepository,
		allowedUser: 'briegel',
		allowedPassword: 'bar',
		allowedPubKeyPath: '/home/briegel/.ssh/id_rsa.pub',
		sshServerKey: Path.resolve(__dirname, '../fixtures/falseGitServerSshKey')
	});
	return port;
}

setup();