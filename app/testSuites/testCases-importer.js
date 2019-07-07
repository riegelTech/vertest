'use strict';

const fs = require('fs');
const path = require('path');

const dirTree = require("directory-tree");
const fsExtra = require('fs-extra');

const WORKING_DIR = path.join(__dirname, '../../cloneDir');
const simpleGit = require('simple-git')(WORKING_DIR);

const asyncBranch = () => new Promise((res, rej) => {
	simpleGit.branch((err, branches) => {
		if (err) {
			rej(err);
		}
		res(branches);
	});
});

const asyncClone = (remoteAddress, localDir) => new Promise((res, rej) => {
	simpleGit.clone(remoteAddress, localDir, (err, success) => {
		if (err) {
			rej(err);
		}
		res(success);
	});
});

const asyncCheckout = revision => new Promise((res, rej) => {
	simpleGit.checkout(revision, (err, success) => {
		if (err) {
			rej(err);
		}
		res(success);
	})
});

/**
 * Extracts test cases (markdown documents content) list from GIT repository
 * @param repoUrl
 * @param branchName
 * @param sourceDir
 * @returns {Promise<void>}
 */
async function extractTestCases(repoUrl, branchName, sourceDir) {
	await fsExtra.emptyDir(WORKING_DIR);
	await asyncClone(repoUrl, WORKING_DIR);
	const existingBranchs = (await asyncBranch()).all;
	if (!existingBranchs.find(branch => branch.endsWith(branchName))) {
		throw new Error(`No branch named ${branchName} in repository ${repoUrl}`);
	}

	await asyncCheckout(branchName);
	const testFiles= {};
	const basePath = path.join(WORKING_DIR, sourceDir);
	dirTree(basePath, {
		extensions: /\.md/,
		exclude: /.git/
	}, item => {
		const testUrl = path.relative(basePath, item.path);
		testFiles[testUrl] = fs.readFileSync(item.path, 'utf8');
	});

	return testFiles;
}

module.exports = extractTestCases;