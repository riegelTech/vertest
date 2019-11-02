'use strict';

const Path = require('path');

const fsExtra = require('fs-extra');
const GitUrlParse = require("git-url-parse");
const NodeGit = require('nodegit');
const Clone = NodeGit.Clone;
const ssh2Utils = require('ssh2').utils;

const appConfig = require('../appConfig/config');
const utils = require('../utils');

const DEFAULT_REPOTE_NAME = 'origin';

class Repository {
    constructor({name = '', address = '', pubKey = '', privKey = '', user = '', pass = '', testDirs = []}) {
        if (!name) {
            throw new Error(`Repository name is mandatory : "${name}" given, please check your configuration.`);
        }
        this.name = name;
        this.address = address;

        if ((pubKey && !privKey) || (privKey && !pubKey)) {
            throw new Error('Only one of public key - private key entity configured, for ssh authentication, both are required, please check your configuration.');
        }

        if (pubKey && pass) {
            throw new Error('Cannot use both ssh and http authentication, please check your configuration.')
        }

        this.pubKey = pubKey;
        this.privKey = privKey;
        this.decryptedPrivKey = false;
        this._privKeyPass = '';

        this.user = user;
        this.pass = pass;

        this._gitRepository = null;
        this._gitBranches = [];

        this._repoDir = Path.join(__dirname, '..', '..', 'cloneDir', this.name);
        this._testDirs = typeof testDirs === 'string' ? [testDirs] : testDirs;
    }

    static get authMethods() {
        return {
            SSH: 'ssh',
            HTTP: 'http'
        }
    }

    get authMethod() {
        return this.pubKey ? Repository.authMethods.SSH : Repository.authMethods.HTTP;
    }

    get gitBranches() {
        return this._gitBranches;
    }

    init() {
        if (this.authMethod === Repository.authMethods.SSH) {
            return this.initSshRepository();
        }
        return this.initHttpRepository();
    }

    async initSshRepository() {
        const keyPath = Path.isAbsolute(this.privKey) ? this.privKey : Path.join(__dirname, '../', '../', this.privKey);
        const keyData = await utils.readFile(keyPath, 'utf8');

        const result = ssh2Utils.parseKey(keyData, this._privKeyPass);
        if (result instanceof  Error) {
            if (result.message.includes('Bad passphrase')) {
                this.decryptedPrivKey = false;
                return;
            }
            throw result;
        }
        this.decryptedPrivKey = true;

        // do not wait the clone sequence to complete to return result
        this.cloneRepository();
    }

    async initHttpRepository() {
        this.cloneRepository();
    }

    async cloneRepository() {
        if (await utils.exists(this._repoDir)) {
            await fsExtra.remove(this._repoDir);
        }
        await utils.mkdir(this._repoDir);


        const opts = {
            fetchOpts: {
                callbacks: {
                    certificateCheck: () => 0
                }
            }
        };
        let creds = null;
        if (this.authMethod === Repository.authMethods.SSH) {
            const url = GitUrlParse(this.address);
            creds = NodeGit.Cred.sshKeyNew(url.user || this.user, this.pubKey, this.privKey, this._privKeyPass);
        }
        if (this.authMethod === Repository.authMethods.HTTP) {
            if (this.user && this.pass) {
                creds = NodeGit.Cred.userpassPlaintextNew(this.user, this.pass);
            } else if (this.user) {
                creds = NodeGit.Cred.usernameNew(this.user);
            }
        }

        if (creds) {
            opts.fetchOpts.callbacks.credentials = function() {
                return creds;
            }
        }

        this._gitRepository = await Clone(this.address, this._repoDir, opts);
        const fullRefPath = `refs/remotes/${DEFAULT_REPOTE_NAME}/`;
        this._gitBranches = (await this._gitRepository.getReferenceNames(NodeGit.Reference.TYPE.ALL))
            .filter(branchName => branchName.startsWith(fullRefPath))
            .map(fullBranchName => fullBranchName.replace(fullRefPath, ''));

        await this.collectTestFilesPaths();
    }

    async collectTestFilesPaths() {
        const testFilesBatches = await Promise.all(this._testDirs.map(testDirGlob => utils.glob(testDirGlob, {cwd: this._repoDir})));
        return [].concat(...testFilesBatches);
    }

    set privKeyPass(privKeyPass) {
        this._privKeyPass = privKeyPass;
    }
}

let repositories = new Map();

async function initRepositories() {
    let config;
    config = await appConfig.getAppConfig();
    if (!config.repositories) {
        return;
    }
    config.repositories.forEach(repoProps => {
        const repository = new Repository(repoProps);
        repositories.set(repository.address, repository);
    });
    return Promise.all(Array.from(repositories.values()).map(repository => repository.init()));
}

function getRepositories() {
    return Array.from(repositories.values());
}

function getRepository(repoAddress) {
    if (!repositories.has(repoAddress)) {
        throw new Error(`No repository found for address "${repoAddress}"`);
    }
    return repositories.get(repoAddress);
}

module.exports = {
    initRepositories,
    getRepositories,
    getRepository
};