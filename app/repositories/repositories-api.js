'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const repositoriesModule = require('../repositories/repositories');
const testSuitesModule = require('../testSuites/testSuite');

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

router.get('/', getRepositories)
    .put('/:repositoryAddress/key-pass', setPrivKey);

module.exports = router;
