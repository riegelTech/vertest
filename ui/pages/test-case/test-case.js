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
				_userUuid: '',
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
		const testSuiteId = this.$route.params.testSuiteId;
		const testCaseId = encodeURIComponent(this.$route.params.testCaseId);
		try {
			const response = await this.$http.get(`${TEST_SUITE_PATH}${testSuiteId}/test-case/${testCaseId}`);
			if (response.status === 200) {
				const testCase =  response.body;
				if (testCase) {
					testCase.mdContent = md.render(testCase._content);
					this.testCase = testCase;
				}
			}
		} catch (resp) {
			window.location.href = '/';
		}
		try {
			this.affectUserPopin.users = await this.getUsers();
		} catch (e) {
			// do nothing
		}
	},
	methods: {
		showAffectUserPopin() {
			this.affectUserPopin.show = true;
		},
		async sendAffectUser() {

		}
	}
};
