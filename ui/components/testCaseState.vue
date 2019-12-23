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
            <md-button v-if="testState !== statuses.TODO" class="md-icon-button md-raised md-accent" @click="changeTestStatus(statuses.TODO)">
                <md-icon>pause_circle_outline</md-icon>
            </md-button>
            <md-button v-if="testState !== statuses.IN_PROGRESS" class="md-icon-button md-raised md-accent" @click="changeTestStatus(statuses.IN_PROGRESS)">
                <md-icon>loop</md-icon>
            </md-button>
            <md-button v-if="testState !== statuses.FAILED" class="md-icon-button md-raised md-accent" @click="changeTestStatus(statuses.FAILED)">
                <md-icon>thumb_down</md-icon>
            </md-button>
            <md-button v-if="testState !== statuses.BLOCKED" class="md-icon-button md-raised" @click="changeTestStatus(statuses.BLOCKED)">
                <md-icon>block</md-icon>
            </md-button>
            <md-button v-if="testState !== statuses.SUCCESS" class="md-icon-button md-raised md-primary" @click="changeTestStatus(statuses.SUCCESS)">
                <md-icon>thumb_up</md-icon>
            </md-button>
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