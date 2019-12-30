'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const repositoriesModule = require('../repositories/repositories');

async function getRepositories(req, res) {
    const repositoriesForApi = repositoriesModule.getRepositories().map(repo => ({
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
        repository = repositoriesModule.getRepository(repoUrl);
    } catch (e) {
        return res.status(404).send(e.message);
    }

    if (repository.authMethod === 'http') {
        res.status(403).send(`Repository with address ${repository.address} does not use SSH authentication`);
    }

    repository.privKeyPass = pass;
    await repository.init(true);

    if (repository.decryptedPrivKey === false) {
        return res.status(403).send(`Fail to decrypt SSH private key for repository ${repository.address}`);
    }
    return res.status(200).send('OK');
}

router.get('/', getRepositories)
    .put('/:repositoryAddress/key-pass', setPrivKey);

module.exports = router;
