<template>
    <div class="test-case-state">
        <div v-if="displayCurrentState" class="current-state">
            <label>{{ $t("testCaseState.Current test status") }}</label><br />
            <span class="current-status-label">{{ statusHR(testState) }}</span>
        </div>
        <div v-if="displayStateSwitch" class="change-state">
            <md-field class="md-adjustable md-no-border">
                <label>{{ $t("testCaseState.New test status") }}</label>
                <md-select v-model="curState" name="testStateSel" id="testStateSel" class="test-state-selector md-mini md-adjustable" @md-selected="changeTestStatus">
                    <md-option :value="statuses.TODO" class="md-mini">{{ $t("testStatuses.To do") }}</md-option>
                    <md-option :value="statuses.IN_PROGRESS" class="md-mini">{{ $t("testStatuses.In progress") }}</md-option>
                    <md-option :value="statuses.FAILED" class="md-mini">{{ $t("testStatuses.Failed") }}</md-option>
                    <md-option :value="statuses.BLOCKED" class="md-mini">{{ $t("testStatuses.Blocked") }}</md-option>
                    <md-option :value="statuses.SUCCESS" class="md-mini">{{ $t("testStatuses.Successful") }}</md-option>
                </md-select>
            </md-field>
        </div>
    </div>
</template>
<script>
    import {TEST_CASE_STATUSES, getTestStateHR} from './test-case';
    export default {
        name: 'test-case-state',
        props: {
            testState: Number,
            displayCurrentState: Boolean,
            displayStateSwitch: Boolean,
            user: Object
        },
        data: function () {
            return {
                statuses: TEST_CASE_STATUSES,
                curState: this.testState
            }
        },
        watch: {
            testState(newStatus) {
                this.changeTestStatus(newStatus);
            }
        },
        methods: {
            changeTestStatus(newStatus) {
            	this.curState = newStatus;
                this.$emit('change-test-status', newStatus);
            },
			statusHR(status) {
            	return getTestStateHR(status);
            }
        }
    }
</script>
<style scoped lang="scss">
.test-case-state {
    display: flex;
    width: 50%;
    min-width: 350px;
    max-width: 450px;
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
}
</style>