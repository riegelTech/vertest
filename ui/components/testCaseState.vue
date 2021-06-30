<template>
    <div class="test-case-state" :class="{ 'switch-displayed' : displayStateSwitch}">
        <div v-if="displayCurrentState && !displayMini" class="current-state">
            <label>{{ $t("testCaseState.Current test status") }}</label><br />
            <span class="status-color" :style="`background-color: ${currentStatus.color}`">&nbsp;</span>
            <span v-if="currentStatus.nameHR" class="current-status-nameHR">
                {{ currentStatus.nameHR }}
                <md-tooltip class="current-status-meaning">
                    <span v-if="currentStatus.meaning">{{ currentStatus.meaning }}</span>
                </md-tooltip>
            </span>
        </div>
        <div v-if="displayCurrentState && displayMini" class="current-state" :class="{mini : displayMini, micro : displayMicro}">
            <span class="status-color" :style="`background-color: ${currentStatus.color}`">
                <md-tooltip class="current-status-meaning">
                    <span v-if="currentStatus.nameHR">{{ currentStatus.nameHR }}</span>
                    <span v-if="currentStatus.meaning">: {{ currentStatus.meaning }}</span>
                </md-tooltip>
            </span>
        </div>
        <div v-if="displayStateSwitch && statuses.length > 0" class="change-state">
            <md-field class="md-adjustable md-no-border">
                <label>{{ $t("testCaseState.New test status") }}</label>
                <md-select v-model="newStatus" name="testStateSel" id="testStateSel" class="test-state-selector md-mini md-adjustable"  @md-selected="changeTestStatus">
                    <md-option v-for="status in statuses" :key="status.name" :value="status.name" class="md-mini">
                        {{ status.nameHR }}
                        <md-tooltip v-if="status.meaning">{{ status.meaning }}</md-tooltip>
                    </md-option>
                </md-select>
            </md-field>
        </div>
    </div>
</template>
<script>
    export default {
        name: 'test-case-state',
        props: {
        	displayMini: {
        		type: Boolean,
                default: false
			},
			displayMicro: {
				type: Boolean,
				default: false
            },
            currentTestStatus: Object,
            displayCurrentState: Boolean,
            displayStateSwitch: Boolean,
			autoSelectCurrentStatus: {
				type: Boolean,
				default: true
			},
            user: Object
        },
        data: function () {
			return {
				statuses: [],
				currentStatus: this.currentTestStatus,
                newStatus: null
			}
		},
		watch: {
			currentTestStatus(newStatus) {
				this.refreshCurrentTestStatus(newStatus);
			}
		},
        mounted() {
			this.init();
        },
        methods: {
        	init() {
				this.statuses = this.$store.state.testCaseStatuses.statuses.map(this.enrichStatus);
				this.refreshCurrentTestStatus(this.currentTestStatus);
				this.newStatus = this.autoSelectCurrentStatus ? this.currentTestStatus.name || this.statuses[0].name : null;
            },
        	enrichStatus(status) {
				const locale = this.$i18n.locale;
				const fallbackLocale = this.$i18n.fallbackLocale;
				const statusForDisplay = {
					name: status.name,
					color: status.color || '#b0bec5',
                    nameHR: status.lang[locale] || status.lang[fallbackLocale] || status.name
				};
				if (status.meaning[locale] || status.meaning[fallbackLocale]) {
					statusForDisplay.meaning = status.meaning[locale] || status.meaning[fallbackLocale];
				}
				return statusForDisplay
            },
			refreshCurrentTestStatus(newCurrentStatus) {
				const existingCurrentStatus = this.statuses.find(status => status.name === newCurrentStatus.name);
				if (existingCurrentStatus) {
					this.currentStatus = existingCurrentStatus;
				} else {
					this.currentStatus = this.enrichStatus(newCurrentStatus);
				}
            },
            changeTestStatus(newStatus) {
				const existingCurrentStatus = this.statuses.find(status => status.name === newStatus);
				if (existingCurrentStatus) {
					this.$emit('change-test-status', this.currentStatus, existingCurrentStatus);
				} else {
					throw new Error(`Unable to find corresponding status with name "${newStatus}"`);
                }
            }
        }
    }
</script>
<style scoped lang="scss">
.test-case-state {
    display: inline-block;
    &.switch-displayed {
        display: flex;
        width: 50%;
        min-width: 350px;
        max-width: 450px;
    }
    .current-state, .change-state {
        flex: 1;
        label {
            color: rgba(0,0,0,0.54);
            font-size: 12px;
        }
        .current-status-label {
            font-size: 12px;
        }
    }
    .current-state {
        .status-color {
            display: inline-block;
            width: 18px;
            height: 18px;
            border-radius: 9px;
        }
        &.mini {
            .status-color {
                display: block;
            }
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        &.micro .status-color {
            width: 14px;
            height: 14px;
            border-radius: 7px;
            position: relative;
            top: 2px;
        }
    }
    .md-field {
        padding: 0;
        margin: 0;
        label {
            display: block;
            position: initial;
        }
    }
}
</style>