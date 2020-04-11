'use strict';

const Path = require('path');

const fsExtra = require('fs-extra');
const GitUrlParse = require("git-url-parse");
const minimatch = require('minimatch');
const NodeGit= require('nodegit');
const {Cred, Clone, Reference, Diff, Checkout, Reset} = NodeGit;
const NodeGitRepository = NodeGit.Repository;
const uuid = require('uuidv4');

const appConfig = require('../appConfig/config');
const sshKeyModule = require('../sshKeys/ssh-keys');
const utils = require('../utils');

const DEFAULT_REMOTE_NAME = 'origin';
const FULL_REF_PATH = `refs/remotes/${DEFAULT_REMOTE_NAME}/`;

class Repository {
    constructor({name = '', address = '', sshKey = '',  user = '', pass = '', repoPath = '', testDirs = []}) {
        if (!name) {
            throw new Error(`Repository name is mandatory : "${name}" given, please check your configuration.`);
        }
        this.name = name;
        this.address = address;

        if (sshKey && !sshKey instanceof sshKeyModule.SshKey) {
            throw new Error('Ssh key parameter is not SshKey instance');
        }

        if (sshKey && pass) {
            throw new Error('Cannot use both ssh and http authentication, please check your configuration.')
        }

        this.sshKey = sshKey;

        this.user = user;
        this.pass = pass;

        this._gitRepository = null;
        this._gitBranches = [];
        this._curHeadCommit = null;

        if (!repoPath) {
            this._repoDir = Path.join(appConfig.workspace.repositoriesDir, this.name);
        } else {
            this._repoDir = repoPath;
        }
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
        return this.sshKey ? Repository.authMethods.SSH : Repository.authMethods.HTTP;
    }

    get decryptedPrivKey() {
        return this.sshKey ? this.sshKey.isDecrypted : false;
    }

    get gitBranches() {
        return this._gitBranches;
    }

    async init({forceInit = false, waitForClone = false}) {
        // if repository exists just open it
        if (await fsExtra.pathExists(this._repoDir) && !forceInit) {
            this._gitRepository = await NodeGitRepository.open(this._repoDir);
            return this.refreshAvailableGitBranches();
        }
        if (this.authMethod === Repository.authMethods.SSH) {
            return this.initSshRepository(waitForClone);
        }
        return this.initHttpRepository(waitForClone);
    }

    async initSshRepository(waitForClone = false) {
        const clonePromise = this.cloneRepository();
        return waitForClone ? clonePromise : undefined;
    }

    async initHttpRepository(waitForClone = false) {
        const clonePromise = this.cloneRepository();
        return waitForClone ? clonePromise : undefined;
    }

    _getRepoConnectionOptions(forFetch = false) {
        const opts = {
            callbacks: {
                certificateCheck: () => 0
            }
        };
        let creds = null;
        if (this.authMethod === Repository.authMethods.SSH) {
            if (!this.sshKey.isDecrypted) {
                const err = new Error(`Private key is encrypted for repository "${this.name}", please decrypt it`);
                err.code = 'EPRIVKEYENCRYPTED';
                throw err;
            }
            const url = GitUrlParse(this.address);
            creds = Cred.sshKeyNew(url.user || this.user, this.sshKey.pubKey, this.sshKey.privKey, this.sshKey.privKeyPass);
        }
        if (this.authMethod === Repository.authMethods.HTTP) {
            if (this.user && this.pass) {
                creds = Cred.userpassPlaintextNew(this.user, this.pass);
            } else if (this.user) {
                creds = Cred.usernameNew(this.user);
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
        await this.refreshAvailableGitBranches();
        this._curHeadCommit = await this._gitRepository.getHeadCommit();
        return this.collectTestFilesPaths();
    }

    async refreshAvailableGitBranches() {
        this._gitBranches = (await this._gitRepository.getReferenceNames(Reference.TYPE.ALL))
            .filter(branchName => branchName.startsWith(FULL_REF_PATH))
            .map(fullBranchName => fullBranchName.replace(FULL_REF_PATH, ''))
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
            flags: Diff.FIND.RENAMES
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

    async checkoutBranch(branchName) {
        let ref;
        try {
            ref = await this._gitRepository.getBranch(branchName);
        } catch (e) {
            const headCommit = await this.getRecentCommitOfBranch(branchName);
            // if branch does not exist, try to create it, pointing to the HEAD commit
            ref = await this._gitRepository.createBranch(branchName, headCommit, true);
        }
        await this._gitRepository.checkoutRef(ref, {
            checkoutStrategy: Checkout.STRATEGY.FORCE
        });
        this._curHeadCommit = await this._gitRepository.getHeadCommit();
        return this._curHeadCommit.sha();
    }

    async checkoutCommit(commitSha) {
        const commit = await this._gitRepository.getCommit(commitSha);
        await Reset.reset(this._gitRepository, commit, Reset.TYPE.HARD);
    }

    async collectTestFilesPaths() {
        const testFilesBatches = await Promise.all(this._testDirs.map(testDirGlob => utils.glob(testDirGlob, {cwd: this._repoDir})));
        return {
            basePath: this._repoDir,
            filePaths: ([].concat(...testFilesBatches))
        };
    }
}

let trackingRepositories = new Map();
let testSuiteRepositories = new Map();

const tempRepositories = new Map();

async function initTrackingRepositories() {
    let config;
    config = await appConfig.getAppConfig();
    if (!config.repositories) {
        return;
    }
    config.repositories.forEach(repoProps => {
        const repository = new Repository(repoProps);
        trackingRepositories.set(repository.address, repository);
    });
    return Promise.all(Array.from(trackingRepositories.values()).map(repository => repository.init({})));
}

function assertTrackingRepositoryExists(repoAddress) {
    if (!trackingRepositories.has(repoAddress)) {
        throw new Error(`No repository found for address "${repoAddress}"`);
    }
}

function getTrackingRepositories() {
    return Array.from(trackingRepositories.values());
}

function getTrackingRepository(repoAddress) {
    assertTrackingRepositoryExists((repoAddress));
    return trackingRepositories.get(repoAddress);
}

function addTestSuiteRepository(repository) {
    testSuiteRepositories.set(repository.name, repository);
}

async function createTempRepository({sshKey = null, address = '', sshKeyUser = '', user = '', pass = ''}) {
    const config = await appConfig.getAppConfig();
    const repoUuid= uuid();

    let repository;
    repository = new Repository({
        name: repoUuid,
        repoPath: Path.join(config.workspace.temporaryRepositoriesDir, repoUuid),
        address,
        sshKey,
        sshKeyUser,
        user,
        pass,
        testDirs: '**/**' // catch all for further test file search
    });

    await repository.init({waitForClone: true});

    tempRepositories.set(repoUuid, repository);

    return {
        repoUuid,
        branches: repository.gitBranches
    };
}

function getTempRepository(repoName) {
    if (!tempRepositories.has(repoName)) {
        throw new Error(`No repository found with name ${repoName}`);
    }

    return tempRepositories.get(repoName);
}

module.exports = {
    Repository,
    initTrackingRepositories,
    getTrackingRepositories,
    getTrackingRepository,
    addTestSuiteRepository,
    createTempRepository,
    getTempRepository
};