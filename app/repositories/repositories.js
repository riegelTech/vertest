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
const LOCAL_REF_PATH = 'refs/heads/';

class Repository {
    constructor({name = '', address = '', sshKey = null,  user = '', pass = '', repoPath = ''}) {
        if (!name) {
            throw new Error(`Repository name is mandatory : "${name}" given.`);
        }
        if (!repoPath) {
            throw new Error(`Repository path is mandatory : "${repoPath}" given.`)
        }
        if (sshKey && pass) {
            throw new Error('Cannot use both ssh and http authentication.')
        }

        this.name = name;
        this.address = address;

        this.setSshKey(sshKey);

        this.user = user;
        this.pass = pass;

        this._gitRepository = null;
        this._gitBranches = [];
        this._curCommit = null;
        this._curBranch = null;

        this._repoDir = repoPath;
    }

    static CATCH_ALL_FILES_PATTERN = '**/**';

    static get authMethods() {
        return {
            SSH: 'ssh',
            HTTP: 'http'
        }
    }

    get authMethod() {
        return this.sshKey ? Repository.authMethods.SSH : Repository.authMethods.HTTP;
    }

    get gitBranches() {
        return this._gitBranches;
    }

    get commit() {
        return this._curCommit ? this._curCommit : null;
    }

    get commitSha() {
        return this._curCommit ? this._curCommit.sha() : null;
    }

    get gitBranch() {
        return this._curBranch;
    }

    static getfullCommit(commit) {
        return {
            sha: commit.sha(),
            date: commit.date().getTime(),
            author: commit.author().toString(false),
            committer: commit.committer().toString(false),
            message: commit.message()
        };
    }

    setSshKey(newSshKey) {
        if (newSshKey && !(newSshKey instanceof sshKeyModule.SshKey)) {
            this.sshKey = new sshKeyModule.SshKey(newSshKey);
        } else {
            this.sshKey = newSshKey;
        }
    }

    async moveRepository(dest) {
        if (!await fsExtra.pathExists(dest)) {
            throw new Error(`Directory ${dest} does not exist`);
        }
        const destDir = Path.join(dest, this.name);
        const oldDir = this._repoDir;
        await utils.mkdir(destDir);
        await fsExtra.copy(this._repoDir, destDir);
        this._repoDir = destDir;

        this._gitRepository = await NodeGitRepository.open(this._repoDir);

        return fsExtra.remove(oldDir);
    }

    async remove() {
        return fsExtra.remove(this._repoDir);
    }

    async init({forceInit = false, waitForClone = false}) {
        // if repository exists just open it
        if (await fsExtra.pathExists(this._repoDir) && !forceInit) {
            this._gitRepository = await NodeGitRepository.open(this._repoDir);
            await this.refreshAvailableGitBranches(false);
            return;
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
        let creds = false;
        if (this.authMethod === Repository.authMethods.SSH) {
            if (!this.sshKey.isDecrypted) {
                const err = new Error(`Private key is encrypted for repository "${this.name}", please decrypt it`);
                err.code = 'EPRIVKEYENCRYPTED';
                throw err;
            }
            creds = true;
        }
        if (this.authMethod === Repository.authMethods.HTTP && this.user) {
            creds = true;
        }

        if (creds) {
            opts.callbacks.credentials = () => {
                if (this.authMethod === Repository.authMethods.SSH) {
                    const url = GitUrlParse(this.address);
                    return Cred.sshKeyNew(url.user || this.user, this.sshKey.pubKey, this.sshKey.privKey, this.sshKey.getPrivKeyPass());
                }
                if (this.authMethod === Repository.authMethods.HTTP) {
                    return Cred.userpassPlaintextNew(this.user, this.pass);
                }
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
        try {
            this._gitRepository = await Clone(this.address, this._repoDir, this._getRepoConnectionOptions());
        } catch (e) {
            if (e.code === 'EPRIVKEYENCRYPTED') {
                throw e;
            }
            const errCode = 'EREPOSITORYCLONEERROR';
            if (e.message.match(/credentials|authentication/)) {
                const err = new Error(`Failed to clone repository ${this.address}, please check your credentials`);
                err.code = errCode;
                throw err;
            }
            if (e.message.match(/Connection refused/)) {
                const err = new Error(`Failed to clone repository, as ${this.address} seems unreachable, please check the repository address`);
                err.code = errCode;
                throw err;
            }
            if (e.message.match(/failed to resolve address/)) {
                const err = new Error(`Failed to resolve repository address ${this.address}, please check the repository address`);
                err.code = errCode;
                throw err;
            }
            const err = new Error(`Failed to clone repository ${this.address}: ${e.message}`);
            err.code = errCode;
            throw err;
        }

        if (this._gitRepository.isEmpty()) {
            return;
        }
        return this.refreshAvailableGitBranches(false);
    }

    async refreshAvailableGitBranches(doFetch = true) {
        if (doFetch) {
            await this.fetchRepository();
        }
        this._curCommit = await this._gitRepository.getHeadCommit();
        this._curBranch = (await this._gitRepository.getCurrentBranch()).name().replace(LOCAL_REF_PATH, '');
        this._gitBranches = (await this._gitRepository.getReferenceNames(Reference.TYPE.ALL))
            .filter(branchName => branchName.startsWith(FULL_REF_PATH))
            .map(fullBranchName => fullBranchName.replace(FULL_REF_PATH, ''))
    }

    async fetchRepository() {
        return this._gitRepository.fetch(DEFAULT_REMOTE_NAME, Object.assign({prune: 1}, this._getRepoConnectionOptions(true)));
    }

    async getCurrentCommit(branchName) {
        return this._gitRepository.getReferenceCommit(branchName);
    }

    async lookupForChanges(testDirs, localChanges = false) {
        let mostRecentCommit;
        try {
            if (localChanges) {
                mostRecentCommit = await this._gitRepository.getReferenceCommit(`${LOCAL_REF_PATH}${this._curBranch}`);
            } else {
                mostRecentCommit = await this._gitRepository.getReferenceCommit(`${FULL_REF_PATH}${this._curBranch}`);
            }
        } catch (e) {
            const err = new Error(`Branch "${this._curBranch}" seems to be remotely deleted on repository "${this.name}"`);
            err.code = 'EDELETEDBRANCH';
            throw err;
        }
        const currentCommit = await this.getCurrentCommit(this._curBranch);
        const newestTree = await mostRecentCommit.getTree();
        const currentTree = await currentCommit.getTree();
        const diff = await newestTree.diff(currentTree);
        const patches = await diff.patches();
        if (!patches.length) {
            return false;
        }
        const matchedPatches = patches.filter(patch => Repository.patchMatchTest(patch, testDirs).globalMatch());
        return matchedPatches.length > 0;
    }

    // TODO finish to factorize
    async getRecentCommitOfBranch(branchName) {
        return (await this._gitRepository.getReferenceCommit(`${FULL_REF_PATH}${branchName}`)).sha();
    }

    static patchMatchTest(patch, testDirs) {
        const newPath = patch.newFile().path();
        const oldPath = patch.oldFile().path();

		const result = {
			newFileMatch: false,
			oldFileMatch: false
		};

        testDirs.forEach(filePattern => {
            const isNegativePattern = filePattern.startsWith('!');
            if (!result.newFileMatch && !isNegativePattern
                && (minimatch(newPath, filePattern))
            ) { // if unselected anymore and positively matched
				result.newFileMatch = true;
            } else if (result.newFileMatch && isNegativePattern
                && (!minimatch(newPath, filePattern))
            ) { // if already selected and negatively matched (rejected)
				result.newFileMatch = false;
            }
            // could use this case to select files that are available against a negative pattern ("some-file.jpg" should be selected by the pattern "!**/**.md")
            // however user will most likely select some files with a first positive pattern and then add negative patterns to exclude some of them
            // in this case, negative patterns should not be interpreted in their "positive" dimension
			// in a nutshell, negative patterns means "all the previous selected files except those that match the pattern"
            // else if (!result.newFileMatch && isNegativePattern && !minimatch(newPath, filePattern)) {
            // 	selected = true;
            // }
			if (!result.oldFileMatch && !isNegativePattern
				&& (minimatch(oldPath, filePattern))
			) { // if unselected anymore and positively matched
				result.oldFileMatch = true;
			} else if (result.oldFileMatch && isNegativePattern
				&& (!minimatch(oldPath, filePattern))
			) { // if already selected and negatively matched (rejected)
				result.oldFileMatch = false;
			}
        });



        return {
        	globalMatch() {
        		return result.newFileMatch || result.oldFileMatch
			},
			newFileMatch() {
        		return result.newFileMatch;
			},
			oldFileMatch() {
        		return result.oldFileMatch;
			}
		};
    }

    async getRepositoryDiff(testSuite, commitSha) {
        const currentCommit = await this.getCurrentCommit(this.gitBranch);
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
            let test = testSuite.getTestCaseByFilePath(diffObject.oldFile().path());
            return Object.assign(diffObject, {test});
        }
        const matchedPatches = patches.filter(patch => Repository.patchMatchTest(patch, testSuite.testDirs).globalMatch()).map(enrichWithTest);

        let addedPatches = matchedPatches
            .filter(patch => patch.isAdded())
            .map(patch => ({file: patch.newFile().path(), test: patch.test}));
        // Some renaming patches make the file to match the test suite file selector must considered as added patch
		const movedSoAddedPatches = (await Promise.all(matchedPatches
			.filter(patch => patch.isRenamed())
			.filter(patch => !Repository.patchMatchTest(patch, testSuite.testDirs).oldFileMatch() && Repository.patchMatchTest(patch, testSuite.testDirs).newFileMatch())
			.map(async patch => ({file: patch.oldFile().path(), newFile: patch.newFile().path()}))));
		// Some modified patches are newly integrated files that match the test dirs, but are not a test yet : they have no corresponding test object
		addedPatches = addedPatches.concat(movedSoAddedPatches);

        let deletedPatches = matchedPatches
            .filter(patch => patch.isDeleted())
            .map(patch => ({file: patch.oldFile().path(), test: patch.test}));

        // Some renaming patches make the file to not match the test suite file selector anymore, must considered as deleted patch
        const movedSoDeletedPatches = (await Promise.all(matchedPatches
            .filter(patch => patch.isRenamed())
            .filter(patch => !Repository.patchMatchTest(patch, testSuite.testDirs).newFileMatch())
            .map(async patch => ({file: patch.oldFile().path(), newFile: patch.newFile().path(), test: patch.test}))));
        deletedPatches = deletedPatches.concat(movedSoDeletedPatches);

        const modifiedPatches = (await Promise.all(matchedPatches
            .filter(patch => patch.isModified() || patch.isRenamed())
            .map(async patch => ({file: patch.oldFile().path(), newFile: patch.newFile().path(), hunks: await getHunks(patch), test: patch.test}))))
            .filter(patch => patch.hunks.length > 0);

        const renamedPatches = matchedPatches
            .filter(patch => patch.isRenamed())
            .filter(patch => Repository.patchMatchTest(patch, testSuite.testDirs).newFileMatch())
            .map(patch => ({file: patch.oldFile().path(), newFile: patch.newFile().path()}));

        return Object.assign(result, {
            addedPatches,
            deletedPatches,
            modifiedPatches: modifiedPatches.filter(patch => patch.test),
            renamedPatches,
            isEmpty: false
        });
    }

    async getRepositoryFilesDiff(testSuite, newFileSelectors) {
        const oldFiles = (await this.collectTestFilesPaths(testSuite.testDirs)).filePaths;
        const newFiles = (await this.collectTestFilesPaths(newFileSelectors)).filePaths;

        function getEnrichedFileDiff(filePath) {
            return {file: filePath, test: testSuite.getTestCaseByFilePath(filePath)};
        }

        const addedPatches = newFiles.filter(newFile => !oldFiles.find(oldFile => oldFile === newFile))
            .map(getEnrichedFileDiff);
        const deletedPatches = oldFiles.filter(oldFile => !newFiles.find(newFile => oldFile === newFile))
            .map(getEnrichedFileDiff);


        const currentCommit = await this.getCurrentCommit(this.gitBranch);

        // TODO diff object should be properly described as a class
        // TODO diff object should include a "non-tracked-anymore" section, for the files that are not deleted by GIT, but that does not match the test suite file selector anymore
        return {
            currentCommit: currentCommit.sha(),
            targetCommit: currentCommit.sha(),
            addedPatches,
            deletedPatches,
            modifiedPatches: [],
            renamedPatches: [],
            isEmpty: addedPatches.length === 0 && deletedPatches.length === 0
        };
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
        await this.refreshAvailableGitBranches(false);
        return this._curCommit.sha();
    }

    async checkoutCommit(commitSha) {
        const commit = await this._gitRepository.getCommit(commitSha);
        await Reset.reset(this._gitRepository, commit, Reset.TYPE.HARD);
    }

    async getGitLog(limit) {
        const ancestors = [];
        for (let i = 1; i <= limit; i++) {
            const ancestor = await this._curCommit.nthGenAncestor(i);
            if (ancestor) {
                ancestors.push(ancestor);
            }
        }

        return ancestors;
    }

    async collectTestFilesPaths(testDirs) {
        let collectedFiles = [];
        for (let filePattern of testDirs) {
            const isNegativePattern = filePattern.startsWith('!');
            if (!isNegativePattern) {
                collectedFiles = collectedFiles.concat(await utils.glob(filePattern, {cwd: this._repoDir, nodir: true}));
            } else if (isNegativePattern) {
                collectedFiles = collectedFiles.filter(fileName => {
                    return minimatch(fileName, filePattern);
                });
            }
        }
        return {
            basePath: this._repoDir,
            filePaths: collectedFiles
        };
    }
}

const tempRepositories = new Map();

async function createTempRepository({sshKey = null, address = '', sshKeyUser = '', user = '', pass = ''}) {
    const config = await appConfig.getAppConfig();
    const repoUuid= uuid.uuid();

    let repository;
    repository = new Repository({
        name: repoUuid,
        repoPath: Path.join(config.workspace.temporaryRepositoriesDir, repoUuid),
        address,
        sshKey,
        sshKeyUser,
        user,
        pass
    });

    await repository.init({waitForClone: true});

    tempRepositories.set(repoUuid, repository);

    return repository;
}

function getTempRepository(repoName) {
    if (!tempRepositories.has(repoName)) {
        throw new Error(`No repository found with name ${repoName}`);
    }

    return tempRepositories.get(repoName);
}

module.exports = {
    Repository,
    createTempRepository,
    getTempRepository
};