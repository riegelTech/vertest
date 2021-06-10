'use strict';

import Vue from 'vue';
Vue.use(require('vue-moment'));

const TEST_SUITE_PATH = '/api/test-suites/';

export default {
    name: 'test-suite-history',
    props: {
        testSuiteId: String
    },
    data() {
        return {
            from: 0,
            number: 10,
            range: 10,
            testSuiteHistory: [],
            currentSort: 'timestamp',
            currentSortOrder: 'desc'
        }
    },
    async mounted() {
        await this.getTestSuiteHistory();
    },
    methods: {
        async getTestSuiteHistory() {
            const response = await this.$http.post(`${TEST_SUITE_PATH}${this.testSuiteId}/history`, {
                from: this.from,
                number: this.number
            });
            if (response.status === 200) {
                response.body.forEach(historyEntry => {
                    historyEntry.timestamp = new Date(historyEntry.timestamp).getTime();
                    historyEntry.signature = `${historyEntry.timestamp}-${historyEntry.message}-${historyEntry.userFirstName}-${historyEntry.userLastName}`;
                    if (this.testSuiteHistory.find(existingEntry => existingEntry.signature === historyEntry.signature) === undefined) {
                        this.testSuiteHistory.push(historyEntry);
                    }
                });
                if (this.currentSortOrder === 'asc') {
                    this.sortAsc();
                } else {
                    this.sortDesc();
                }
                this.from = this.testSuiteHistory.length;
                this.number = this.from + this.range;
            }
        },
        sortDesc() {
            this.testSuiteHistory.sort((a, b) => {
                if (a.timestamp > b.timestamp) {
                    return -1;
                }
                if (a.timestamp < b.timestamp) {
                    return 1;
                }
                return 0;
            });
        },
        sortAsc() {
            this.testSuiteHistory.sort((a, b) => {
                if (a.timestamp < b.timestamp) {
                    return -1;
                }
                if (a.timestamp > b.timestamp) {
                    return 1;
                }
                return 0;
            });
        }
    }
};
