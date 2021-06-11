'use strict';

import {userMixin} from '../pages/users/userMixin';
import TestCaseState from './testCaseState.vue';

const md = require('markdown-it')();
const url = require('url');
const Path = require('path-browserify');

const TEST_SUITE_PATH = '/api/test-suites/';

export const TEST_CASE_STATUSES = {
	TODO: 0,
	IN_PROGRESS: 1,
	BLOCKED: 3,
	SUCCESS: 4,
	FAILED: 5
};
const TEST_CASE_STATUSES_HR = {
	[TEST_CASE_STATUSES.TODO]: 'To do',
	[TEST_CASE_STATUSES.IN_PROGRESS]: 'In progress',
	[TEST_CASE_STATUSES.BLOCKED]: 'Blocked',
	[TEST_CASE_STATUSES.SUCCESS]: 'Successful',
	[TEST_CASE_STATUSES.FAILED]: 'Failed',

};

export const getTestStateHR = function(status) {
	const statusHr = TEST_CASE_STATUSES_HR[status];
	if (statusHr) {
		return window.app.$t(`testStatuses.${statusHr}`);
	}
	return window.app.$t('testStatuses.unknown');
};

export default {
	components: {
		TestCaseState
	},
	name: 'test-case',
	props: {
		testSuiteId: String,
		testCase: Object,
		siblingTestCases: Array
	},
	data: function () {
		return {
			testCaseStatuses: TEST_CASE_STATUSES,
			testCaseLocal: this.testCase,
			currentUser: {
				readOnly: true
			},
			affectUserPopin: {
				show: false,
				users: [],
				selectedUser: null
			},
			appConfig: null
		}
	},
	mixins: [userMixin],
	watch: {
		testCase: function(testCaseToDisplay) {
			this.testCaseLocal = testCaseToDisplay;
		 	this.initTestCase();
		 }
	},
	async mounted() {
		return this.initTestCase();
	},
	methods: {
		async initTestCase() {
			if (!this.testCaseLocal) {
				return;
			}

			const testCaseBasePath = this.testCaseLocal.basePath;
			const relativeTestFile = this.testCaseLocal.testFilePath;
			const siblingTestCases = this.siblingTestCases;
			const currentUrl = window.location;

			const defaultImageRender = md.renderer.rules.image;
			md.renderer.rules.image = function (tokens, idx, options, env, self) {
				const token = tokens[idx];
				const src = token.attrs[token.attrIndex('src')][1];
				const resourceUrl = url.parse(src);

				if (!resourceUrl.protocol && !resourceUrl.host) {
					token.attrs[token.attrIndex('src')][1] = `${currentUrl.origin}/repositoriesStatics/${Path.basename(testCaseBasePath)}/${Path.dirname(relativeTestFile)}/${src}`;
				}
				// pass token to default renderer.
				return defaultImageRender(tokens, idx, options, env, self);
			};

			const defaultLinkRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
				return self.renderToken(tokens, idx, options);
			};
			md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
				const token = tokens[idx];
				const href = token.attrs[token.attrIndex('href')][1];
				const resourceUrl = url.parse(href);

				if (!resourceUrl.protocol && !resourceUrl.host) {
					const resourceRelativePath = Path.join(Path.dirname(relativeTestFile), href);
					const isASibling = siblingTestCases.find(testCase => testCase.testFilePath === resourceRelativePath);
					if (isASibling) { // document also included in the test suite's regular and tracked tests
						const hashPath = currentUrl.hash;
						token.attrs[token.attrIndex('href')][1] = url.resolve(currentUrl.href, Path.join(hashPath, `../${encodeURIComponent(encodeURIComponent(resourceRelativePath))}`));
					} else {
						if (Path.extname(href) === '.md') {
							const resourceIdentifier = encodeURIComponent(encodeURIComponent(`${Path.basename(testCaseBasePath)}/${Path.dirname(relativeTestFile)}/${href}`));
							token.attrs[token.attrIndex('href')][1] = `${currentUrl.origin}/#/mdvisu/${resourceIdentifier}`;
						} else {
							token.attrs[token.attrIndex('href')][1] = `${currentUrl.origin}/repositoriesStatics/${Path.basename(testCaseBasePath)}/${Path.dirname(relativeTestFile)}/${href}`;
						}
					}
				}
				// pass token to default renderer.
				return defaultLinkRender(tokens, idx, options, env, self);
			};


			let testCase;

			try {
				const response = await this.$http.get(`${TEST_SUITE_PATH}${this.testSuiteId}/test-case/${encodeURIComponent(encodeURIComponent(this.testCaseLocal.testFilePath))}`);
				if (response.status === 200) {
					testCase = response.body;
				}
			} catch (resp) {
				// do nothing
			}
			if (testCase) {
				testCase.mdContent = md.render(testCase.content);
				this.testCaseLocal = testCase;
			}
			try {
				this.affectUserPopin.users = await this.getUsers();
				const userId = testCase.user._id;
				const existingUser = this.affectUserPopin.users.find(user => user._id === userId);
				if (existingUser) {
					this.testCaseLocal.user = existingUser;
				}
			} catch (e) {
				// do nothing
			}
		},
		showAffectUserPopin() {
			if (this.currentUser.readOnly) {
				alert('As read-only user, you do not have rights to do this');
			}
			if (this.testCaseLocal.user) {
				this.affectUserPopin.selectedUser = this.testCaseLocal.user._id;
			}
			this.affectUserPopin.show = true;
		},
		async sendAffectUser() {
			const testSuiteId = this.$route.params.testSuiteId;
			const testCaseId = encodeURIComponent(encodeURIComponent(this.testCaseLocal.testFilePath));
			try {
				const selectedUser = this.affectUserPopin.users.find(user => user._id === this.affectUserPopin.selectedUser);
				this.testCaseLocal.user = selectedUser;
				const response = await this.$http.post(`${TEST_SUITE_PATH}${testSuiteId}/test-case/${testCaseId}/attach-user/`, {
					userId: this.affectUserPopin.selectedUser
				});
				if (response.status === 200) {
					this.affectUserPopin.show = false;
					this.$emit('updateTestCase', this.testCaseLocal);
					await this.initTestCase();
				}
			} catch (resp) {
				alert('User attachment failed');
			}
		},
		async changeTestStatus(newStatus) {
			const testSuiteId = this.$route.params.testSuiteId;
			const testCaseId = encodeURIComponent(encodeURIComponent(this.testCaseLocal.testFilePath));
			try {
				this.testCaseLocal.status = newStatus;
				const response = await this.$http.put(`${TEST_SUITE_PATH}${testSuiteId}/test-case/${testCaseId}/set-status/`, {
					newStatus
				});
				if (response.status === 200) {
					this.$emit('updateTestCase', this.testCaseLocal);
					await this.initTestCase();
				}
			} catch (resp) {
				alert('Status update failed');
			}
		}
	}
};
