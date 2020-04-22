<template>
    <span>
        <span v-if="displayCurrentState">
            <md-icon v-if="curState === statuses.TODO">play_circle_outline</md-icon>
            <md-icon v-if="curState === statuses.IN_PROGRESS && !user">person</md-icon>
            <md-icon v-if="curState === statuses.IN_PROGRESS && user">
                <md-tooltip md-direction="top">{{ user.firstName }} {{ user.lastName }}</md-tooltip>
                person
            </md-icon>
            <md-icon v-if="curState === statuses.FAILED">clear</md-icon>
            <md-icon v-if="curState === statuses.BLOCKED">report</md-icon>
            <md-icon v-if="curState === statuses.SUCCESS">done</md-icon>
        </span>
        <span v-if="displayStateSwitch">
            <md-field>
                <md-select v-model="curState" name="testStateSel" id="testStateSel" class="test-state-selector" @md-selected="changeTestStatus">
                    <md-option :value="statuses.TODO">To do</md-option>
                    <md-option :value="statuses.IN_PROGRESS">In progress</md-option>
                    <md-option :value="statuses.FAILED">Failed</md-option>
                    <md-option :value="statuses.BLOCKED">Blocked</md-option>
                    <md-option :value="statuses.SUCCESS">Success</md-option>
                </md-select>
            </md-field>
        </span>
    </span>
</template>
<script>
    import {TEST_CASE_STATUSES} from './test-case';
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
            }
        }
    }
</script>
<style scoped lang="scss">

</style>