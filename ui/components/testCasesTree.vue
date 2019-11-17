<template>
    <li>
        <div
                :class="{bold: isFolder}"
                @click="toggle">
            <span v-if="isFolder">
                {{ item.name }}
            </span>
            <router-link  v-if="!isFolder" :to="`/test-suites/${testSuiteId}/test-case/${encodeURIComponent(encodeURIComponent(item.path))}`">
                {{ item.name }}
            </router-link>
            <span v-if="isFolder">[{{ isOpen ? '-' : '+' }}]</span>
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
	export default {
		name: 'test-cases-tree',
		props: {
			testSuiteId: '',
			item: Object
		},
		data: function () {
			return {
				isOpen: false
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

<style scoped>

</style>