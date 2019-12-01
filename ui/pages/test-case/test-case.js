'use strict';

import MainLayout from '../../layouts/main.vue';
import {userMixin} from "../users/users";

const md = require('markdown-it')();

const TEST_SUITE_PATH = '/api/test-suites/';

export default {
	components: {
		MainLayout
	},
	data() {
		return {
			testCase: {
				_user: '',
				_testFilePath: '',
				_content: '',
				_status: 0
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
		return this.initTestCase();
	},
	methods: {
		async initTestCase() {
			const testSuiteId = this.$route.params.testSuiteId;
			const testCaseId = encodeURIComponent(this.$route.params.testCaseId);
			try {
				const response = await this.$http.get(`${TEST_SUITE_PATH}${testSuiteId}/test-case/${testCaseId}`);
				if (response.status === 200) {
					const testCase =  response.body;
					if (testCase) {
						testCase.mdContent = md.render(testCase._content);
						this.testCase.user = this.testCase._user;
						this.testCase = testCase;
					}
				}
			} catch (resp) {
				window.location.href = '/';
			}
			try {
				this.affectUserPopin.users = await this.getUsers();
				const userId = testCase._user._id;
				const existingUser = this.affectUserPopin.users.find(user => user._id === userId);
				if (existingUser) {
					this.testCase.user = existingUser;
				}
			} catch (e) {
				// do nothing
			}
		},
		showAffectUserPopin() {
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
		}
	}
};
