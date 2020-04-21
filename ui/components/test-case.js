'use strict';

import {userMixin} from '../pages/users/users';
import TestCaseState from './testCaseState.vue';

const md = require('markdown-it')();

const TEST_SUITE_PATH = '/api/test-suites/';

export const TEST_CASE_STATUSES = {
	TODO: 0,
	IN_PROGRESS: 1,
	BLOCKED: 3,
	SUCCESS: 4,
	FAILED: 5
};

export default {
	components: {
		TestCaseState
	},
	name: 'test-case',
	props: {
		testSuiteId: String,
		testCase: Object
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
			}
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
		return this.initTestCase()
;	},
	methods: {
		async initTestCase() {
			if (!this.testCaseLocal) {
				return;
			}
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
			this.affectUserPopin.show = true;
		},
		async sendAffectUser() {
			const testSuiteId = this.$route.params.testSuiteId;
			const testCaseId = encodeURIComponent(encodeURIComponent(this.testCaseLocal.testFilePath));
			try {
				const response = await this.$http.post(`${TEST_SUITE_PATH}${testSuiteId}/test-case/${testCaseId}/attach-user/`, {
					userId: this.affectUserPopin.selectedUser
				});
				if (response.status === 200) {
					this.affectUserPopin.show = false;
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
				const response = await this.$http.put(`${TEST_SUITE_PATH}${testSuiteId}/test-case/${testCaseId}/set-status/`, {
					newStatus
				});
				if (response.status === 200) {
					await this.initTestCase();
				}
			} catch (resp) {
				alert('Status update failed');
			}
		}
	}
};
