'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const appConfig = require('../appConfig/config');

async function getRepositories(req, res) {
    let repositories;
    let config;
    try {
        config = await appConfig.getAppConfig();
        if (!config.repositories) {
            return res.status(404).send({
                success: false,
                error: 'No repositories configured'
            });
        }
    } catch (e) {
        return res.status(500).send({
            error: e.message
        })
    }

    repositories = config.repositories;
    const keysToExpose = ['name', 'address'];
    repositories = repositories.map(repo => _.pick(repo, keysToExpose));
    res.send(repositories);
}

router.get('/', getRepositories);

module.exports = router;
