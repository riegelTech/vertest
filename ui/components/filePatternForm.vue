<template>
    <div>
        <div>
            <ul class="patterns-list">
                <li v-for="(filePattern, filePatternIndex) in filePatterns" :value="filePattern" :key="filePatternIndex">
                    <md-button class="md-icon-button md-mini md-accent" @click="deleteFilePattern(filePatternIndex)">
                        <md-icon>delete</md-icon>
                        <md-tooltip md-direction="top">Remove this pattern</md-tooltip>
                    </md-button>
                    {{ filePattern.signification }}
                </li>
            </ul>
        </div>
        <div class="md-layout md-gutter selected-files">
            <div class="md-layout-item md-size-50">
                <strong>Available files</strong>
                <ul class="file-tree">
                    <file-tree class="item"
                               :item="availableFilesTree"
                               :displayLink="false"
                               :displaySelectors="true"
                               @select-item="selectItemForTestSuiteCreation"
                               @unselect-item="unselectItemForTestSuiteCreation"
                    >
                    </file-tree>
                </ul>
            </div>
            <div class="md-layout-item md-size-50">
                <strong>Selected files</strong>
                <ul class="file-tree">
                    <file-tree class="item"
                               v-if="selectedFilesTree"
                               :item="selectedFilesTree"
                               :displayLink="false">
                    </file-tree>
                </ul>
            </div>
        </div>
    </div>
</template>

<script>
	import minimatch from 'minimatch';

	import FileTree from './fileTree.vue';
	import {fileTreeUtils} from './fileTree.js';

	const filePatterns = [{
		pattern: /^\*\*\/\*\*\.md$/,
		signification: 'Include all the markdown files of the repository'
	}, {
		pattern: /^!\*\*\/\*\*\.md$/,
		signification: 'Exclude all the markdown files of the repository'
	}, {
		pattern: /^([^*!]*?)\/\*\*\/\*\*\.md$/,
		signification: 'Include all the markdown files in directory "$1" and in its descendants'
	}, {
		pattern: /^!([^*!]*?)\/\*\*\/\*\*\.md$/,
		signification: 'Exclude all the markdown files in directory "$1" and in its descendants'
	}, {
		pattern: /^([^*!]*?)\/\*\*\.md$/,
		signification: 'Include all the markdown files in directory "$1"'
	}, {
		pattern: /^!([^*!]*?)\/\*\*\.md$/,
		signification: 'Exclude all the markdown files in directory "$1"'
	}, {
		pattern: /^([^*!]*?\.[a-zA-Z]{1,5})$/,
		signification: 'Include the file "$1"'
	}, {
		pattern: /^!([^*!]*?\.[a-zA-Z]{1,5})$/,
		signification: 'Exclude the file "$1"'
	}];

	function getPatternSignification(rawFilePattern) {
		const matchingPattern = filePatterns.find(filePattern => {
			return rawFilePattern.match(filePattern.pattern);
		});
		if (!matchingPattern) {
			return {
				pattern: rawFilePattern,
				signification: 'Custom file selection pattern'
			};
		}
		return {
			pattern: rawFilePattern,
			signification: rawFilePattern.replace(matchingPattern.pattern, matchingPattern.signification)
		};
	}

	export const filePatternSignification = {
		filePatterns,
		getPatternSignification
	};

	export default {
		components: {
			FileTree
		},
		name: 'file-pattern-form',
		props: {
			initialFilePatterns: Array,
			availableFilesTree: Object
		},
		data: function () {
			return {
				filePatterns: [],
				selectedFilesTree: null
			}
		},
		watch: {
			availableFilesTree: function() { // sometimes the property initialFilePatterns comes late after the component rendering
				this.updateMatchedFiles();
			}
		},
        mounted() {
			this.filePatterns = this.initialFilePatterns.map(filePattern => getPatternSignification(filePattern));
			this.updateMatchedFiles();
			this.$emit('file-patterns-changed', this.filePatterns);
        },
		methods: {
			addFilePattern(treeItem, positive = true) {
				let pattern = positive ? '' : '!';
				if (treeItem.name === 'root') {
					pattern = `${pattern}**/**.md`;
				} else if (treeItem.children === null) { // item is a file
					pattern = `${pattern}${treeItem.fullPath.replace(/^(root\/)/, '')}`;
				} else { // item is a directory
					pattern = `${pattern}${treeItem.fullPath.replace(/^(root\/)/, '')}/**/**.md`;
				}
				const fullPatternObject = getPatternSignification(pattern);
				this.filePatterns.push(fullPatternObject);

				this.updateMatchedFiles();
				this.$emit('file-patterns-changed', this.filePatterns);
            },
			updateMatchedFiles() {
				if (this.filePatterns.length === 0) {
					this.selectedFilesTree = Object.assign({}, this.availableFilesTree);
					return;
				}

				const flatFiles = fileTreeUtils.flattenLeafs(this.availableFilesTree)
					.map(leaf => leaf.fullPath.replace(/^(root\/)/, ''));

				const selectedFiles = flatFiles.filter(filePath => {
					let selected = false;
					this.filePatterns.forEach(filePattern => {
						const isNegativePattern = filePattern.pattern.startsWith('!');
						if (!selected && !isNegativePattern && minimatch(filePath, filePattern.pattern)) { // if unselected anymore and positively matched
							selected = true;
						} else if (selected && isNegativePattern && !minimatch(filePath, filePattern.pattern)) { // if already selected and negatively matched (rejected)
							selected = false;
						}
						// could use this case to select files that are available against a negative pattern ("some-file.jpg" should be selected by the pattern "!**/**.md")
						// however user will most likely select some files with a first positive pattern and then add negative patterns to exclude some of them
						// in this case, negative patterns should not be interpreted in their "positive" dimension
						// else if (!selected && isNegativePattern && !minimatch(filePath, filePattern.pattern)) {
						// 	selected = true;
						// }
					});
					return selected;
				});
				this.selectedFilesTree = fileTreeUtils.buildTree(selectedFiles, this.availableFilesTree.path);
			},
            deleteFilePattern(filePatternIndex) {
				let firstChunk = [];
				if (filePatternIndex > 0) {
					firstChunk = this.filePatterns.slice(0, filePatternIndex);
				}
				let lastChunk = [];
				if (filePatternIndex < this.filePatterns.length) {
					lastChunk = this.filePatterns.slice(filePatternIndex + 1);
				}
				this.filePatterns = firstChunk.concat(lastChunk);
				this.updateMatchedFiles();
				this.$emit('file-patterns-changed', this.filePatterns);
			},
			unselectItemForTestSuiteCreation(item) {
				this.addFilePattern(item, false);
			},
			selectItemForTestSuiteCreation(item) {
				this.addFilePattern(item, true);
			}
		}
	};
</script>

<style scoped lang="scss">
    ul.file-tree, ul.patterns-list {
        list-style-type: none;
        padding-left: 0;
    }
    ul.patterns-list li {
        line-height: 40px;
    }
    .selected-files {
        max-height: 300px;
        overflow-y: auto;
    }
</style>