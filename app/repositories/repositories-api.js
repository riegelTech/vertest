'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const appConfig = require('../appConfig/config');

function getRepositories(req, res) {
    let repositories;
    let config;
    try {
        config = appConfig.getAppConfig();
        if (!config.repositories) {
            res.status(404).send({
                success: dalse,
                error: 'No repositories configured'
            });
        }
    } catch (e) {
        res.status(500).send({
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
