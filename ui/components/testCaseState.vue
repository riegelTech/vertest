<template>
    <span>
        <span v-if="displayCurrentState">
            <md-icon v-if="testState === statuses.TODO">pause_circle_outline</md-icon>
            <md-icon v-if="testState === statuses.IN_PROGRESS">loop</md-icon>
            <md-icon v-if="testState === statuses.FAILED">thumb_down</md-icon>
            <md-icon v-if="testState === statuses.BLOCKED">block</md-icon>
            <md-icon v-if="testState === statuses.SUCCESS">thumb_up</md-icon>
        </span>
        <span v-if="displayStateSwitch">
            <md-select v-model="testState" name="testStateSel" id="testStateSel" class="test-state-selector" @md-selected="changeTestStatus">
                <md-option :value="statuses.TODO"><md-icon>pause_circle_outline</md-icon>To do</md-option>
                <md-option :value="statuses.IN_PROGRESS"><md-icon>loop</md-icon>In progress</md-option>
                <md-option :value="statuses.FAILED"><md-icon>thumb_down</md-icon>Failed</md-option>
                <md-option :value="statuses.BLOCKED"><md-icon>block</md-icon>Blocked</md-option>
                <md-option :value="statuses.SUCCESS"><md-icon>thumb_up</md-icon>Success</md-option>
            </md-select>
        </span>
    </span>
</template>
<script>
    import {TEST_CASE_STATUSES} from '../pages/test-case/test-case';
    export default {
        name: 'test-case-state',
        props: {
            testState: Number,
            displayCurrentState: Boolean,
            displayStateSwitch: Boolean
        },
        data: function () {
            return {
                statuses: TEST_CASE_STATUSES
            }
        },
        methods: {
            changeTestStatus(newStatus) {
                this.$emit('change-test-status', newStatus);
            }
        }
    }
</script>
<style scoped lang="scss">
.test-state-selector {
    .md-list-item-text {
        display: block;
    }
}
</style>