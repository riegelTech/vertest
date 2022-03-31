'use strict';

const url = require('url');
const Path = require('path');

const _ = require('lodash');
const express = require('express');
const router = express.Router();
const xss = require('xss');

const appConfig = require('../appConfig/config');
const logsModule = require('../logsModule/logsModule');
const logs = logsModule.getDefaultLoggerSync();
const testSuiteModule = require('../testSuites/testSuite');
const statusModule = require('./testCaseStatuses');
const usersModule = require('../users/users');
const utils = require('../utils');

let xssProtection = null;
const DEFAULT_XSS_PROTECTION_CONF = {
	whiteList: {
		a: [
			'href',
			'title',
			'target'
		],
		img: [
			'src',
			'width',
			'height',
			'style'
		],
		div: [],
		p: [],
		ul: [],
		ol: [],
		li: [],
		em: [],
		strong: [],
		h1: [],
		h2: [],
		h3: [],
		h4: [],
		h5: [],
		h6: [],
		blockquote: [],
		code: [],
		pre: []
	}
};

const md = require('markdown-it')({
	html: true,
	xhtmlOut: true
});
const mdOptions = {
	root: '.',
	getRootDir: (options, state, startLine, endLine) => {
		return state.env.getIncludeRootDir(options, state, startLine, endLine);
	},
	getRootScope: (options, state, startLine, endLine) => {
		return state.env.getIncludeRootScope(options, state, startLine, endLine);
	},
	rootScopeProtection: true,
	bracesAreOptional: true
};
const markdownItInclude = require('markdown-it-include');
md.use(markdownItInclude, mdOptions);

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
					token.attrs[token.attrIndex('href')][1] = `/repositoriesStatics/${Path.basename(testCase.basePath)}/${Path.dirname(testCase.testFilePath)}/${href}`;
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
		const err = new Error(`Test case not found for path ${testCasePath}`);
		err.code = 'ENOTFOUND';
		throw err;
	}
	return {
		testSuite,
		testCase
	}
}

async function loadXssProtectionConf() {
	const conf = await appConfig.getAppConfig();
	const xssFileConf = conf.workspace.xssConfigFile;

	if (!xssFileConf) {
		return DEFAULT_XSS_PROTECTION_CONF;
	}
	try {
		await utils.access(xssFileConf);
		const xssFileContent = await utils.readFile(xssFileConf);
		return JSON.parse(xssFileContent);
	} catch (e) {
		throw new Error(`Error decoding XSS protection file: ${e.message}`);
	}
}

async function getTestCase(req, res) {
	const lang = req.cookies.lang;
	let testSuite, testCase;
	try {
		const testItems = getTestFromUrlParam(req);
		testSuite = testItems.testSuite;
		testCase = testItems.testCase;
	} catch (e) {
		logs.error(e.message);
		return res.status(utils.getHttpCode(e.code)).send(e.message);
	}

	try {
		if (!xssProtection) {
			const xssConf = await loadXssProtectionConf();
			xssProtection = new xss.FilterXSS(xssConf);
		}
	} catch (e) {
		logs.error(e.message);
		return res.status(utils.getHttpCode(e.code)).send(e.message);
	}

	// relatives paths to external resources
	overrideDefaultMdRenderers(testSuite, testCase, lang);

	let mdPath = Path.join(testCase.basePath, testCase.testFilePath);
	const env = {
		getIncludeRootDir: function (options, state, startLine, endLine) {
			return Path.dirname(mdPath);
		},
		getIncludeRootScope: function (options, state, startLine, endLine) {
			return testCase.basePath;
		}
	};

	let htmlContent;
	try {
		let state = new md.core.State(testCase.content, md, env);
		md.core.process(state);
		let tokens = state.tokens;
		htmlContent = md.renderer.render(tokens, md.options, env);
	} catch (e) {
		logs.error(e.message);
		return res.status(utils.getHttpCode(e.code)).send('Markdown parsing failed');
	}
	try {
		testCase.htmlContent = xssProtection.process(htmlContent);
		return res.status(200).send(testCase);
	} catch (e) {
		logs.error(e.message);
		return res.status(utils.getHttpCode(e.code)).send('XSS protection failed');
	}
}


async function affectUser(req, res) {
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

	const defaultStatus = statusModule.getStatuses().defaultStatus;
	const nextDefaultStatus = statusModule.getStatuses().getStatusByIndex(1);

	if (req.body.userId !== null) {
		const user = await usersModule.getUser(userId);
		testCase.user = _.omit(user, ['password']);
		testCase.setStatus(nextDefaultStatus);
	} else {
		testCase.user = null;
		testCase.setStatus(defaultStatus);

	}

	try {
		await testSuiteModule.updateTestSuite(testSuite);
		if (testCase.user) {
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case "${testCase.testFilePath}" successfully affected to user "${testCase.user.login}"`, testCase.testFilePath);
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case status automatically switched to "${nextDefaultStatus.name}"`, testCase.testFilePath);
		} else {
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case "${testCase.testFilePath}" successfully unaffected`, testCase.testFilePath);
			await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case status automatically switched to "${defaultStatus.name}"`, testCase.testFilePath);
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
	const curUser = usersModule.getCurrentUser();
	const newTestStatus = new statusModule.Status(req.body.newStatus);

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
	try {
		const oldStatusName = testCase.status.name;
		testCase.setStatus(newTestStatus);
		if (testCase.status.isDefaultStatus) {
			testCase.user = null;
		}
		await testSuiteModule.updateTestSuite(testSuite);
		await logsModule.auditLogForTestSuite(testSuite._id, curUser, `Test case "${testCase.testFilePath}" status successfully changed from "${oldStatusName}" to "${newTestStatus.name}"`, testCase.testFilePath);
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
