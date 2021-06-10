<template>
    <div v-if="display" class="breadcrumb">
        <router-link :to="`/${$i18n.locale}/`" class="home">
            <md-icon>home</md-icon>
            <md-tooltip md-direction="top">{{ $t("homePage.Home page") }}</md-tooltip>
        </router-link>
        <span v-for="relatedRoute in relatedRoutes" :key="relatedRoute.path">
            &gt;
            <router-link :to="relatedRoute.path">
                {{ relatedRoute.label }}
            </router-link>
        </span>

    </div>
</template>
<script>
	import Vue from 'vue';

	const path = require('path-browserify');

	export const breadCrumbEventBus = new Vue();
	export default {
		name: "breadCrumb",
        data() {
			return {
                display: false,
                relatedRoutes: []
            }
        },
		watch: {
			'$route.params.testCaseId': function (testCaseId) {
				if (testCaseId) {
					this.addTestCaseToBreadCrumb();
                } else {
					this.removeTestCaseFromBreadCrumb();
				}
			}
		},
        mounted() {
			if (this.$route.path === '/') {
				this.display = false;
				return;
            }
			this.display = true;

			breadCrumbEventBus.$on('initCurrentTestSuite', () => this.addTestSuiteToBreadCrumb());
			breadCrumbEventBus.$on('initCurrentTestCase', () => this.addTestCaseToBreadCrumb());
			this.addTestSuiteToBreadCrumb();
			this.addTestCaseToBreadCrumb();
        },
        methods: {
			addTestSuiteToBreadCrumb() {
				const testSuite = this.$store.state.currentTestSuite;
				if (!testSuite) {
					return;
                }
				this.relatedRoutes[0] = {
					path: `/${this.$route.params.lang}/test-suites/${this.$route.params.testSuiteId}`,
					label: testSuite.name
				};
				this.$forceUpdate();
            },
			addTestCaseToBreadCrumb() {
				const testCase = this.$store.state.currentTestCase;
				if (!testCase) {
					return;
                }
                this.relatedRoutes[1] = {
                    path: `/${this.$route.params.lang}/test-suites/${this.$route.params.testSuiteId}/test-case/${encodeURIComponent(encodeURIComponent(testCase.testFilePath))}`,
                    label: path.basename(testCase.testFilePath)
                };

				this.$forceUpdate();
            },
			removeTestCaseFromBreadCrumb() {
				this.relatedRoutes.splice(1,1);
				this.$forceUpdate();
            }
        }
	}
</script>
<style scoped lang="scss">
    .breadcrumb {
        padding-left: 14px;
        margin: 5px 0;
        color: #448aff;
        a {
            text-decoration: none;
        }
        a.home i{
            color: #448aff;
            font-size: 20px !important;
            position: relative;
            top: -2px;
        }
    }
</style>