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
				_user: {},
				_testFilePath: '',
				_content: '',
				_status: 0,
				user: {}
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
			let testCase;
			try {
				const response = await this.$http.get(`${TEST_SUITE_PATH}${testSuiteId}/test-case/${testCaseId}`);
				if (response.status === 200) {
					testCase =  response.body;
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
		}
	}
};
