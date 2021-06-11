'use strict';

const _ = require('lodash');
const express = require('express');
const router = express.Router();
const url = require('url');
const Path = require('path');

const logsModule = require('../logsModule/logsModule');
const logs = logsModule.getDefaultLoggerSync();
const testSuiteModule = require('../testSuites/testSuite');
const usersModule = require('../users/users');
const utils = require('../utils');


const mdOptions = {
	root: '',
	getRootDir: (options, state, startLine, endLine) => {
		return state.env.getIncludeRootDir(options, state, startLine, endLine);
	},
	bracesAreOptional: true
};

const markdownItInclude = require('markdown-it-include');
const md = require('markdown-it')().use(markdownItInclude, mdOptions);

const defaultImageRender = md.renderer.rules.image;
const defaultLinkRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
	return self.renderToken(tokens, idx, options);
};

function overrideDefaultMdRenderers(testSuite, testCase, lang) {
	md.renderer.rules.image = function (tokens, idx, options, env, self) {
		const token = tokens[idx];
		const src = token.attrs[token.attrIndex('src')][1];
		const resourceUrl = url.parse(src);

		if (!resourceUrl.protocol && !resourceUrl.host) {
			token.attrs[token.attrIndex('src')][1] = `/repositoriesStatics/${Path.basename(testCase.basePath)}/${Path.dirname(testCase.testFilePath)}/${src}`;
		}
		// pass token to default renderer.
		return defaultImageRender(tokens, idx, options, env, self);
	};

	md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
		const token = tokens[idx];
		const href = token.attrs[token.attrIndex('href')][1];
		const resourceUrl = url.parse(href);

		if (!resourceUrl.protocol && !resourceUrl.host) {
			const resourceRelativePath = Path.join(Path.dirname(testCase.testFilePath), href);
			const siblingTest = testSuite.tests.find(testCase => testCase.testFilePath === resourceRelativePath);
			if (siblingTest) { // document also included in the test suite's regular and tracked tests
				token.attrs[token.attrIndex('href')][1] = `/#/${lang}/test-suites/${testSuite._id}/test-case/${encodeURIComponent(encodeURIComponent(siblingTest.testFilePath))}`;
			} else {
				if (Path.extname(href) === '.md') {
					const resourceIdentifier = encodeURIComponent(encodeURIComponent(`${Path.basename(testCase.basePath)}/${Path.dirname(testCase.testFilePath)}/${href}`));
					token.attrs[token.attrIndex('href')][1] = `/#/${lang}/mdvisu/${resourceIdentifier}`;
				} else {
					token.attrs[token.attrIndex('href')][1] = `/#/${lang}/repositoriesStatics/${Path.basename(testCase.basePath)}/${Path.dirname(testCase.testFilePath)}/${href}`;
				}
			}
		}
		// pass token to default renderer.
		return defaultLinkRender(tokens, idx, options, env, self);
	};
}


function getTestFromUrlParam(req) {
	const testSuiteUuid = req.testSuiteUuid;
	const testCasePath = decodeURIComponent(req.params.testCasePath);
	const testSuite = testSuiteModule.getTestSuiteByUuid(testSuiteUuid);
	const testCase = testSuite.tests.find(testCase => testCase.testFilePath === testCasePath);
	if (!testCase) {
		throw new Error(`Test case not found for path ${testCasePath}`);
	}
	return {
		testSuite,
		testCase
	}
}


function assertUserIsNotReadOnly() {
	const curUser = usersModule.getCurrentUser();
	if (curUser.readOnly) {
		const err =  new Error(`User "${curUser.login}" (${curUser._id}) is readonly`);
		err.code =  RESPONSE_HTTP_CODES.LOCKED;
		throw err;
	}
}

async function getTestCase(req, res) {
	try {
		const lang = req.cookies.lang;
		const {testSuite, testCase} = getTestFromUrlParam(req);

		// relatives paths to external resources
		overrideDefaultMdRenderers(testSuite, testCase, lang);

		// markdown inclusions management
		let mdPath = Path.join(testCase.basePath, testCase.testFilePath);
		const env = {
			getIncludeRootDir: function () {
				return Path.dirname(mdPath);
			}
		};
		let state = new md.core.State(testCase.content, md, env);
		md.core.process(state);
		let tokens = state.tokens;
		testCase.htmlContent = md.renderer.render(tokens, md.options, env);

		res.status(200).send(testCase);
	} catch (e) {
		res.status(utils.RESPONSE_HTTP_CODES.ENOTFOUND).send(e.message);
	}
}


async function affectUser(req, res) {
	try {
		assertUserIsNotReadOnly();
	} catch (e) {
		logs.error(e.message);
		res.status(utils.getHttpCode(e.code));
		return res.send({
			success: false,
			msg: e.message
		});
	}
	const curUser = usersModule.getCurrentUser();
	const userId = req.body.userId;

	let testSuite;
	let testCase;
	try {
		const entities = getTestFromUrlParam(req);
		testSuite = entities.testSuite;
		testCase = entities.testCase;
	} catch (e) {
		logs.error(e.message);
		res.status(utils.RESPONSE_HTTP_CODES.ENOTFOUND).send(e.message);
	}

	if (req.body.userId !== null) {
		const user = await usersModule.getUser(userId);
		testCase.user = _.omit(user, ['password']);
		testCase.setStatus(TestCase.STATUSES.IN_PROGRESS);
	} else {
		testCase.user = null;
		testCase.setStatus(TestCase.STATUSES.TODO);

	}

	try {
		await testSuiteModule.updateTestSuite(testSuite);
		if (testCase.user) {
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case "${testCase.testFilePath}" successfully affected to user "${testCase.user.login}"`, testCase.testFilePath);
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case status automatically switched to "${TestCase.STATUS_HR(TestCase.STATUSES.IN_PROGRESS)}"`, testCase.testFilePath);
		} else {
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case "${testCase.testFilePath}" successfully unaffected`, testCase.testFilePath);
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case status automatically switched to "${TestCase.STATUS_HR(TestCase.STATUSES.TODO)}"`, testCase.testFilePath);
		}
	} catch (e) {
		logs.error(e.message);
		res.status(utils.RESPONSE_HTTP_CODES.DEFAULT);
	}

	return res.send({
		success: true
	});
}

async function updateTestStatus(req, res) {
	try {
		assertUserIsNotReadOnly();
	} catch (e) {
		logs.error(e.message);
		res.status(utils.getHttpCode(e.code));
		return res.send({
			success: false,
			msg: e.message
		});
	}

	const curUser = usersModule.getCurrentUser();
	let newTestStatus;
	switch (req.body.newStatus) {
		case TestCase.STATUSES.SUCCESS:
			newTestStatus = TestCase.STATUSES.SUCCESS;
			break;
		case TestCase.STATUSES.FAILED:
			newTestStatus = TestCase.STATUSES.FAILED;
			break;
		case TestCase.STATUSES.BLOCKED:
			newTestStatus = TestCase.STATUSES.BLOCKED;
			break;
		case TestCase.STATUSES.TODO:
			newTestStatus = TestCase.STATUSES.TODO;
			break;
		default:
			newTestStatus = TestCase.STATUSES.IN_PROGRESS;
	}

	let testSuite;
	let testCase;
	try {
		const entities = getTestFromUrlParam(req);
		testSuite = entities.testSuite;
		testCase = entities.testCase;
	} catch (e) {
		logs.error(e.message);
		return res.status(utils.RESPONSE_HTTP_CODES.ENOTFOUND).send(e.message);
	}

	if (testCase.user && testCase.user._id !== curUser._id) {
		const errMessage = `User "${curUser.firstName} ${curUser.lastName}" is not allowed to change ${testCase.testFilePath} status`;
		logs.error(errMessage);
		return res.status(utils.RESPONSE_HTTP_CODES.LOCKED)
			.send(errMessage);
	}
	const oldStatus = TestCase.STATUS_HR(testCase.status);
	const newStatus = TestCase.STATUS_HR(newTestStatus);
	try {
		testCase.setStatus(newTestStatus);
		if (testCase.status === TestCase.STATUSES.TODO) {
			testCase.user = null;
		}

		await testSuiteModule.updateTestSuite(testSuite);
		await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case "${testCase.testFilePath}" status successfully changed from "${oldStatus}" to "${newStatus}"`, testCase.testFilePath);
		if (testCase.user === null) {
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case "${testCase.testFilePath}" successfully unaffected`, testCase.testFilePath);
		}
		return res.status(200).send('ok');
	} catch(e) {
		logs.error(e.message);
		res.status(utils.getHttpCode(e.code));
		res.send({
			success: false,
			msg: e.message
		});
	}
}


router.get('/:testCasePath', getTestCase)
	.post('/:testCasePath/attach-user/', affectUser)
	.put('/:testCasePath/set-status/', updateTestStatus);

module.exports = router;
