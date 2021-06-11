<template>
    <main-layout>
        <div v-html="resourceContent" class="mdVisu"></div>
    </main-layout>
</template>

<script>
    const RESOURCE_PATH = 'repositoriesStatics';

	import MainLayout from '../layouts/main.vue';

	const mdIncludeOptions = {
		//root: '/bogus/',
		includeRe: /#include(.+)/,
		// show the
		// getRootDir: (options, state, startLine, endLine) =>
		// 	state.env.getIncludeRootDir(options, state, startLine, endLine),
		bracesAreOptional: true
	};

	const md = require('markdown-it')()
		.use(require('markdown-it-include'), mdIncludeOptions);
	export default {
		name: 'markdown-visualizer',
        components: {
			MainLayout
		},
        data() {
			return {
				resourceContent: null
            };
        },
        async mounted() {
            return this.getMdContent();
        },
        methods: {
			async getMdContent() {
				const resourcePath = decodeURIComponent(this.$route.params.resource);
				const currentUrl = window.location;
                const fullResourceUrl = `${currentUrl.origin}/${RESOURCE_PATH}/${resourcePath}`;
				try {
					const response = await this.$http.get(fullResourceUrl);
					if (response.status === 200) {
						this.resourceContent = md.render(response.body);
					}
				} catch (resp) {
					this.resourceContent = `Error, unable to fetch document content : ${resp.status}`;
				}
            }
        }
	}
</script>
<style scoped lang="scss">
.mdVisu {
    padding: 1em;
}
</style>