'use strict';

import {appConfig, appConfigEventBus, statusesEndpoints} from '../components/appConfig';
import {userMixin, userEventBus} from '../pages/users/userMixin';
import TestCaseState from '../components/testCaseState.vue';

const defaultCurrentUser = null;

export default {
	mixins: [userMixin, appConfig],
	components: {
		TestCaseState
	},
	data: () => ({
		showNavigation: false,
		showSidepanel: false,
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
	mounted() {
		appConfigEventBus.$on('appConfigLoaded', () => {
			this.appConfig = this.$store.state.appConfig;
		});
		appConfigEventBus.$on('testCaseStatusesInconsistenciesLoaded', () => {
			this.showStatusesInconsistenciesPopin();
		});
		userEventBus.$on('initCurrentUser', () => {
			this.currentUser = this.$store.state.currentUser;
		});
		userEventBus.$on('userLogin', () => {
			this.currentUser = this.$store.state.currentUser;
		});
	},
	methods: {
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
