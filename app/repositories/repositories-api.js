'use strict';

const express = require('express');
const router = express.Router();

const repositoriesModule = require('../repositories/repositories');
const sshKeyModule = require('../sshKeys/ssh-keys');
const testSuitesModule = require('../testSuites/testSuite');

const utils = require('../utils');

async function getRepositories(req, res) {
    const repositoriesForApi = repositoriesModule.getTrackingRepositories().map(repo => ({
        name: repo.name,
        address: repo.address,
        authMethod: repo.authMethod,
        decryptedPrivKey: repo.decryptedPrivKey,
        gitBranches: repo.gitBranches
    }));
    res.send(repositoriesForApi);
}

async function setPrivKey(req, res) {
    const repoUrl = decodeURIComponent(req.params['repositoryAddress']);
    const pass = req.body.keyPass;
    let repository;
    try {
        repository = repositoriesModule.getTrackingRepository(repoUrl);
    } catch (e) {
        return res.status(404).send(e.message);
    }

    if (repository.authMethod === 'http') {
        res.status(403).send(`Repository with address ${repository.address} does not use SSH authentication`);
    }

    repository.privKeyPass = pass;
    await repository.init({forceInit: true, waitForClone: false});
    if (repository.decryptedPrivKey === false) {
        return res.status(403).send(`Fail to decrypt SSH private key for repository ${repository.address}`);
    }

    const testSuites = await testSuitesModule.getTestSuites();
    await Promise.all(testSuites
        .filter(testSuite => testSuite.repository.address === repoUrl)
        .map(async testSuite => {
            testSuite.repository.privKeyPass = pass;
            return testSuite.repository.init({forceInit: true, waitForClone: false});
        }));

    return res.status(200).send('OK');
}

async function createTemporaryRepository(req, res) {
    const sshKey = req.body.repositorySshKey ? sshKeyModule.getSshKeyByName(req.body.repositorySshKey) : null;
    if (sshKey instanceof sshKeyModule.SshKey && req.body.repositorySshKeyPass) {
        const success = await sshKey.setPrivKeyPass(req.body.repositorySshKeyPass);
        if (!success) {
            return res.status(403).send(`Fail to decrypt SSH private key ${req.body.repositorySshKey}`);
        }
    }

    let result;
    try {
        result = await repositoriesModule.createTempRepository({
            sshKey,
            address: req.body.repositoryAddress,
            sshKeyUser: req.body.repositorySshKeyUser,
            user: req.body.repositoryLogin,
            pass: req.body.repositoryPass
        });
    } catch (e) {
        return res.status(utils.RESPONSE_HTTP_CODES.DEFAULT).send('Repository creation failed');
    }


    return res.status(200).send(result);
}

async function getRepositoryFiles(req, res) {
    const repository = repositoriesModule.getTempRepository(req.params.repoUuid);

    await repository.init({forceInit: false, waitForClone: true});

    const branchName = req.body.gitBranch;

    await repository.checkoutBranch(branchName);
    const filesAndBasePath = await repository.collectTestFilesPaths();

    res.status(200).send(filesAndBasePath);
}

router.get('/', getRepositories)
    .post('/temp', createTemporaryRepository)
	.post('/temp/:repoUuid/files', getRepositoryFiles)
    .put('/:repositoryAddress/key-pass', setPrivKey);

module.exports = router;
