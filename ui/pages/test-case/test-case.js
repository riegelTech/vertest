'use strict';

import MainLayout from '../../layouts/main.vue';
import {userMixin} from '../users/users';
import TestCaseState from '../../components/testCaseState.vue';

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
		MainLayout,
		TestCaseState
	},
	data() {
		return {
			testCaseStatuses: TEST_CASE_STATUSES,
			testCase: {
				user: {},
				testFilePath: '',
				content: '',
				mdContent: '',
				status: TEST_CASE_STATUSES.TODO
			},
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
	async mounted() {
		// TODO find simplest way to watch the current user loading
		this.$store.watch(storeState => {
			if (storeState.currentUser) {
				this.currentUser = storeState.currentUser;
				return this.initTestCase();
			}
		}, storeState => {
			return storeState.currentUser;
		});
	},
	methods: {
		async initTestCase() {
			const testSuiteId = this.$route.params.testSuiteId;
			const testCaseId = encodeURIComponent(this.$route.params.testCaseId);
			if (testCaseId === 'undefined') {
				return;
			}
			let testCase;
			try {
				const response = await this.$http.get(`${TEST_SUITE_PATH}${testSuiteId}/test-case/${testCaseId}`);
				if (response.status === 200) {
					testCase =  response.body;
				}
			} catch (resp) {
				window.location.href = '/';
			}
			if (testCase) {
				testCase.mdContent = md.render(testCase.content);
				this.testCase = testCase;
			}
			try {
				this.affectUserPopin.users = await this.getUsers();
				const userId = testCase.user._id;
				const existingUser = this.affectUserPopin.users.find(user => user._id === userId);
				if (existingUser) {
					this.testCase.user = existingUser;
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
			const testCaseId = encodeURIComponent(this.$route.params.testCaseId);
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
			const testCaseId = encodeURIComponent(this.$route.params.testCaseId);
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
