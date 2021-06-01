'use strict';

import Vue from 'vue';
Vue.use(require('vue-moment'));

export default {
    name: 'test-suite-history',
    props: {
        testSuiteId: String,
        testSuiteHistoryBase: Array
    },
    data() {
        return {
            testSuiteHistory: this.testSuiteHistoryBase || []
        }
    },
    async mounted() {
        return;
    },
    methods: {

    }
};
