<template>
    <li>
        <div
                :class="{bold: isFolder}"
                @click="toggle">
            <span class="folder" v-if="isFolder">
                {{ item.name }}
            </span>
            <router-link  v-if="!isFolder" :to="`/test-suites/${testSuiteId}/test-case/${encodeURIComponent(encodeURIComponent(item.path))}`">
                {{ item.name }}
            </router-link>
            <span class="status-icon" v-if="!isFolder && item.testCase">
                <md-icon v-if="item.testCase.status === statuses.TODO">pause_circle_outline</md-icon>
                <md-icon v-if="item.testCase.status === statuses.IN_PROGRESS">loop</md-icon>
                <md-icon v-if="item.testCase.status === statuses.FAILED">thumb_down</md-icon>
                <md-icon v-if="item.testCase.status === statuses.BLOCKED">block</md-icon>
                <md-icon v-if="item.testCase.status === statuses.SUCCESS">thumb_up</md-icon>
            </span>
        </div>
        <ul v-show="isOpen" v-if="isFolder">
            <test-cases-tree
                    class="item"
                    v-for="(child, index) in item.children"
                    :key="index"
                    :item="child"
                    :testSuiteId="testSuiteId"
            ></test-cases-tree>
        </ul>
    </li>
</template>

<script>
    import {TEST_CASE_STATUSES} from '../pages/test-case/test-case';
	export default {
		name: 'test-cases-tree',
		props: {
			testSuiteId: '',
			item: Object
		},
		data: function () {
			return {
				isOpen: true,
				statuses: TEST_CASE_STATUSES
			}
		},
		computed: {
			isFolder() {
				return this.item.children &&
					this.item.children.length
			}
		},
		methods: {
			toggle() {
				if (this.isFolder) {
					this.isOpen = !this.isOpen
				}
			}
		}
	};
</script>

<style scoped lang="scss">
    ul {
        list-style-type: none;
        padding-left: 2em;
        li {
            position: relative;
            &:before,
            &:after {
                font-family: Material Icons;
                -webkit-font-feature-settings: "liga";
                font-feature-settings: "liga";
                position: absolute;
            }
            &:before {

                content: "more_horiz";
                top: 0.2em;
                left: -1em;
            }
            &:after {
                content: "more_vert";
                top: -0.4em;
                left: -1.3em;
            }
        }
        .folder {
            cursor: pointer;
            font-weight: bold;
        }
    }
</style>