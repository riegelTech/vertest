'use strict';

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
        console.log(this.testSuiteHistory);
        return ;
    },
    methods: {

    }
};
