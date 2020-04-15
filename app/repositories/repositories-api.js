'use strict';

const express = require('express');
const router = express.Router();

const repositoriesModule = require('../repositories/repositories');
const sshKeyModule = require('../sshKeys/ssh-keys');

const utils = require('../utils');

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

router.post('/temp', createTemporaryRepository)
	.post('/temp/:repoUuid/files', getRepositoryFiles);

module.exports = router;
