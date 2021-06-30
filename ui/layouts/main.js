'use strict';

import {mainWrapperEventBus} from './main-event-bus';
import {userMixin, userEventBus} from '../pages/users/userMixin';
import TestCaseState from '../components/testCaseState.vue';

const defaultCurrentUser = null;

const CONFIG_PATH = '/api/config';
const TEST_CASE_STATUSES_PATH = '/api/statuses/';
const TEST_CASE_STATUSES_INCONSISTENCIES_PATH = `${TEST_CASE_STATUSES_PATH}inconsistencies`;


export default {
	mixins: [userMixin],
	components: {
		TestCaseState
	},
	data: () => ({
		appReady: false,
		showNavigation: false,
		showSidepanel: false,
		loginPopup: {
			show: false,
			authError: null,
			loginFieldMessageClass: '',
			passwordFieldMessageClass: ''
		},
		currentUser: defaultCurrentUser,
		appConfig: null,
		sshKeys: [],
		statusesInconsistenciesPopin: {
			show: false,
			deprecatedStatuses: [],
			remediationStatuses: {},
			error: null
		}
	}),
	async mounted() {
		userEventBus.$on('initCurrentUser', async () => {
			if (!this.$store.state.currentUser) {
				this.showLoginPopup();
				return;
			}
			this.currentUser = this.$store.state.currentUser;
			await this.initAppConfig();
		});
		userEventBus.$on('userLogin', async () => {
			this.currentUser = this.$store.state.currentUser;
			this.hideLoginPopup();
			await this.initAppConfig();
		});
		userEventBus.$on('userLoginFail', () => {
			const errorClass = 'md-invalid';
			this.loginPopup.loginFieldMessageClass = this.userLogin ? '' : errorClass;
			this.loginPopup.passwordFieldMessageClass = this.userPassword ? '' : errorClass;
			this.loginPopup.authError = this.$t("homePage.Invalid login or password, please retry");
			return;
		});

		await this.initUser();
	},
	methods: {
		async initAppConfig() {
			try{
				const appConfigResponse = await this.$http.get(CONFIG_PATH);
				if (appConfigResponse.status === 200) {
					this.appConfig = appConfigResponse.body;
					this.$store.commit('appConfig', this.appConfig);
				}

				const statusesResponse = await this.$http.get(TEST_CASE_STATUSES_PATH);
				if (statusesResponse.status === 200) {
					this.$store.commit('testCaseStatuses', statusesResponse.body);
				}

				const inconsistenciesResponse = await this.$http.get(TEST_CASE_STATUSES_INCONSISTENCIES_PATH);
				if (inconsistenciesResponse.status === 200) {
					this.$store.commit('testCaseStatusesInconsistencies', inconsistenciesResponse.body);
					this.showStatusesInconsistenciesPopin();
				}

				this.appReady = true;
				mainWrapperEventBus.$emit('appReady');
			} catch (resp) {
				if (resp.status === 401) {
					window.location.href = `/#/${this.$i18n.locale}`;
					return;
				}
				throw resp;
			}
		},
		hideLoginPopup() {
			this.loginPopup.show = false;
		},
		showLoginPopup() {
			this.loginPopup.show = true;
		},
		showStatusesInconsistenciesPopin() {
			if (this.$store.state.testCaseStatusesInconsistencies.length === 0) {
				return;
			}

			this.statusesInconsistenciesPopin.deprecatedStatuses = [];
			this.$store.state.testCaseStatusesInconsistencies.forEach(inconsistency => {
				if (!this.statusesInconsistenciesPopin.deprecatedStatuses.find(deprecatedStatus => deprecatedStatus.name === inconsistency.currentStatus.name)) {
					this.statusesInconsistenciesPopin.deprecatedStatuses.push(inconsistency.currentStatus);
				}
				this.statusesInconsistenciesPopin.remediationStatuses[inconsistency.currentStatus.name] = null;
			});

			this.statusesInconsistenciesPopin.show = true;
		},
		hideStatusesInconsistenciesPopin() {
			this.statusesInconsistenciesPopin.show = false;
		},
		addStatusRemediation(oldStatus, newStatus) {
			this.statusesInconsistenciesPopin.remediationStatuses[oldStatus.name] = newStatus;
		},
		async sendStatusesRemediation() {
			for (let remediation in this.statusesInconsistenciesPopin.remediationStatuses) {
				if (this.statusesInconsistenciesPopin.remediationStatuses[remediation] === null){
					this.statusesInconsistenciesPopin.error = this.$t('mainLayout.Some deprecated statuses have no target status, please choose a target status for each one');
					return;
				}
			}

			const remediationResponse = await this.$http.post(statusesEndpoints.TEST_CASE_STATUSES_INCONSISTENCIES_PATH, this.statusesInconsistenciesPopin.remediationStatuses);
			if (remediationResponse.status === 200) {
				this.hideStatusesInconsistenciesPopin();
			} else {
				this.statusesInconsistenciesPopin.error = this.$t('mainLayout.Something went wrong with the last operation, please retry');
			}
		}
	}
};
