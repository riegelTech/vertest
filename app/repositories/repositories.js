'use strict';

const Path = require('path');

const fsExtra = require('fs-extra');
const GitUrlParse = require("git-url-parse");
const minimatch = require('minimatch');
const NodeGit = require('nodegit');
const Clone = NodeGit.Clone;
const ssh2Utils = require('ssh2').utils;

const appConfig = require('../appConfig/config');
const utils = require('../utils');

const DEFAULT_REMOTE_NAME = 'origin';
const FULL_REF_PATH = `refs/remotes/${DEFAULT_REMOTE_NAME}/`;

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
        this._curHeadCommit = null;

        this._repoDir = Path.join(__dirname, '..', '..', 'cloneDir', this.name);
        this._testDirs = typeof testDirs === 'string' ? [testDirs] : testDirs;
        // Avoid first slash or dot - slash to start pattern
        this._testDirs = this._testDirs.map(testDirPattern => testDirPattern.replace(/^(\/|\.\/)/, ''));
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

    async init(forceInit) {
        // if repository exists just open it
        if (await fsExtra.pathExists(this._repoDir) && !forceInit) {
            this._gitRepository = await NodeGit.Repository.open(this._repoDir);
            await this.refreshAvailableGitBranches();
            return;
        }
        if (this.authMethod === Repository.authMethods.SSH) {
            return this.initSshRepository();
        }
        return this.initHttpRepository();
    }

    async refreshAvailableGitBranches() {
        this._gitBranches = (await this._gitRepository.getReferenceNames(NodeGit.Reference.TYPE.ALL))
            .filter(branchName => branchName.startsWith(FULL_REF_PATH))
            .map(fullBranchName => fullBranchName.replace(FULL_REF_PATH, ''))
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

    _getRepoConnectionOptions(forFetch = false) {
        const opts = {
            callbacks: {
                certificateCheck: () => 0
            }
        };
        let creds = null;
        if (this.authMethod === Repository.authMethods.SSH) {
            if (!this.decryptedPrivKey) {
                const err = new Error(`Private key is encrypted for repository "${this.name}", please decrypt it`);
                err.code = 'EPRIVKEYENCRYPTED';
                throw err;
            }
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
            opts.callbacks.credentials = function() {
                return creds;
            }
        }

        return forFetch ? opts : {
            fetchOpts: opts
        };
    }

    async cloneRepository() {
        if (await utils.exists(this._repoDir)) {
            await fsExtra.remove(this._repoDir);
        }
        await utils.mkdir(this._repoDir);

        this._gitRepository = await Clone(this.address, this._repoDir, this._getRepoConnectionOptions());
        await this.refreshBranches();
        this._curHeadCommit = await this._gitRepository.getHeadCommit();
        await this.collectTestFilesPaths();
    }

    async refreshBranches() {
        this._gitBranches = (await this._gitRepository.getReferenceNames(NodeGit.Reference.TYPE.ALL))
            .filter(branchName => branchName.startsWith(FULL_REF_PATH))
            .map(fullBranchName => fullBranchName.replace(FULL_REF_PATH, ''));
    }

    fetchRepository() {
        return this._gitRepository.fetch(DEFAULT_REMOTE_NAME, Object.assign({prune: 1}, this._getRepoConnectionOptions(true)));
    }

    async getCurrentCommit(branchName) {
        return this._gitRepository.getReferenceCommit(branchName);
    }

    async lookupForChanges(branchName) {
        let mostRecentCommit;
        try {
            mostRecentCommit = await this._gitRepository.getReferenceCommit(`${FULL_REF_PATH}${branchName}`);
        } catch (e) {
            const err = new Error(`Branch "${branchName}" seems to be remotely deleted on repository "${this.name}"`);
            err.code = 'EDELETEDBRANCH';
            throw err;
        }
        const currentCommit = await this.getCurrentCommit(branchName);
        const newestTree = await mostRecentCommit.getTree();
        const currentTree = await currentCommit.getTree();
        const diff = await newestTree.diff(currentTree);
        const patches = await diff.patches();
        if (!patches.length) {
            return false;
        }
        const testDirs = this._testDirs;
        function fileMatchTest(patch) {
            return testDirs.some(testDir => minimatch(patch.oldFile().path(), testDir) || minimatch(patch.newFile().path(), testDir));
        }
        const matchedPatches = patches.filter(fileMatchTest);
        return matchedPatches.length > 0;
    }

    // TODO finish to factorize
    async getRecentCommitOfBranch(branchName) {
        return (await this._gitRepository.getReferenceCommit(`${FULL_REF_PATH}${branchName}`)).sha();
    }

    async getRepositoryDiff(testSuite, commitSha) {
        const currentCommit = await this.getCurrentCommit(testSuite.gitBranch);
        const mostRecentCommit = await this._gitRepository.getCommit(commitSha);

        const newestTree = await mostRecentCommit.getTree();
        const currentTree = await currentCommit.getTree();
        const diff = await newestTree.diff(currentTree);
        await diff.findSimilar({
            flags: NodeGit.Diff.FIND.RENAMES
        });

        const result = {
            currentCommit: currentCommit.sha(),
            targetCommit: mostRecentCommit.sha(),
            isEmpty: true
        };

        const patches = await diff.patches();
        if (!patches.length) {
            return Object.assign(result, {
                addedPatches: [],
                deletedPatches: [],
                modifiedPatches: [],
                renamedPatches: []
            });
        }
        const testDirs = this._testDirs;
        function fileMatchTest(patch) {
            return testDirs.some(testDir => minimatch(patch.oldFile().path(), testDir) || minimatch(patch.newFile().path(), testDir));
        }
        async function getHunks(patch) {
            const hunks = await patch.hunks();
            if (!hunks.length) {
                return [];
            }
            return Promise.all(hunks.map(async hunk => {
                const lines = await hunk.lines();
                return {
                    oldLines: {
                        start: hunk.oldStart(),
                        content: lines.filter(line => String.fromCharCode(line.origin()) === '-').map(line => line.content().trim())
                    },
                    newLines: {
                        start: hunk.newStart(),
                        content: lines.filter(line => String.fromCharCode(line.origin()) === '+').map(line => line.content().trim())
                    }
                }
            }));
        }
        function enrichWithTest(diffObject) {
            const test = testSuite.getTestCaseByFilePath(diffObject.oldFile().path());
            return Object.assign(diffObject, {test});
        }
        const matchedPatches = patches.filter(fileMatchTest).map(enrichWithTest);
        const addedPatches = matchedPatches
            .filter(patch => patch.isAdded())
            .map(patch => ({file: patch.newFile().path(), test: patch.test}));
        const deletedPatches = matchedPatches
            .filter(patch => patch.isDeleted())
            .map(patch => ({file: patch.oldFile().path(), test: patch.test}));
        const modifiedPatches = (await Promise.all(matchedPatches
            .filter(patch => patch.isModified() || patch.isRenamed())
            .map(async patch => ({file: patch.oldFile().path(), newFile: patch.newFile().path(), hunks: await getHunks(patch), test: patch.test}))))
            .filter(patch => patch.hunks.length > 0);
        const renamedPatches = matchedPatches
            .filter(patch => patch.isRenamed())
            .map(patch => ({file: patch.oldFile().path(), newFile: patch.newFile().path()}));

        return Object.assign(result, {
            addedPatches,
            deletedPatches,
            modifiedPatches,
            renamedPatches,
            isEmpty: false
        });
    }

    async checkoutBranch(branchName, targetCommit = 'HEAD') {
        let ref;
        try {
            ref = await this._gitRepository.getBranch(branchName);
        } catch (e) {
            const headCommit = await this.getRecentCommitOfBranch(branchName);
            // if branch does not exist, try to create it, pointing to the HEAD commit
            ref = await this._gitRepository.createBranch(branchName, headCommit, true);
        }
        await this._gitRepository.checkoutRef(ref, {
            checkoutStrategy: NodeGit.Checkout.STRATEGY.FORCE
        });
        this._curHeadCommit = await this._gitRepository.getHeadCommit();
        return this._curHeadCommit.sha();
    }

    async checkoutCommit(commitSha) {
        const commit = await this._gitRepository.getCommit(commitSha);
        await NodeGit.Reset.reset(this._gitRepository, commit, NodeGit.Reset.TYPE.HARD);
    }

    async collectTestFilesPaths() {
        const testFilesBatches = await Promise.all(this._testDirs.map(testDirGlob => utils.glob(testDirGlob, {cwd: this._repoDir})));
        return ([].concat(...testFilesBatches)).map(relativeTestPath => ({basePath: this._repoDir, testFilePath: relativeTestPath}));
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
    // TODO if repositories have been cleaned, they have to be checkouted on the revision stored with test-suite object in DB
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