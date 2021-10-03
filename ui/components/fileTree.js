'use strict';

import TestCaseState from './testCaseState.vue';
import Path from "path";
import _ from "lodash";

const TREE_ROOT = 'root';

export const fileTreeUtils = {
	buildTree(filePaths, baseDir) {

		const shortenedFilePaths = filePaths.map(filePath => {
			const shortenedFilePath = `${TREE_ROOT}/${filePath.replace(baseDir, '')}`;
			const filePathSplit = shortenedFilePath.split(Path.sep);
			return {
				splitPath: filePathSplit.length === 1 ? filePathSplit : filePathSplit.slice(1),
				fullPath: shortenedFilePath
			};
		});

		function buildTreeRecursive(filePaths, parentPath = '') {
			const tree = [];
			for (let filePath of filePaths) {
				if (!filePath.splitPath[0]) {
					continue;
				}
				const dir = filePath.splitPath[0];
				if (!tree.find(existingDir => existingDir.name === dir)) { // if the path does not exist on the tree
					const sameDirs = filePaths.filter(testPath => testPath.splitPath[0] === dir);
					const currentPath = Path.join(parentPath, dir);
					const children = buildTreeRecursive(sameDirs.map(sameDir => ({
						splitPath: sameDir.splitPath.slice(1),
						fullPath: sameDir.fullPath,
					})), currentPath);
					tree.push({
						name: dir,
						path: filePath.splitPath.length > 1 ? '' : filePath.fullPath,
						fullPath: children.length > 0 ? currentPath : filePath.fullPath,
						children: children.length > 0 ? children : null
					});
				}
			}
			if (tree.length > 0) {
				tree[tree.length - 1] = Object.assign(tree[tree.length - 1], {isLastChild: true});
			}
			return tree;
		}

		return Object.assign({}, this.defaultRootTree(baseDir), {
			children: buildTreeRecursive(shortenedFilePaths)
		});
	},
	defaultRootTree(baseDir = '/') {
		return {
			name: TREE_ROOT,
			path: baseDir,
			fullPath: baseDir,
			children: null,
			isLastChild: true
		};
	},
	flattenLeafs(tree) {
		let flat = [];
		this.leafTransformer(_.cloneDeep(tree), treeSegment => {
			flat.push(treeSegment);
		});
		return flat;
	},
	leafTransformer(treeToTransform, transformFn) {
		function recursiveTransformTree(treeToTransform) {
			if (treeToTransform.children) {
				treeToTransform.children = treeToTransform.children.map(treeChild => recursiveTransformTree(treeChild));
			} else {
				treeToTransform = transformFn(treeToTransform);
			}
			return treeToTransform;
		}
		return recursiveTransformTree(treeToTransform);
	},
	filterTree(treeToFilter, filterFn) {
		function recursiveFilterTree(treeToFilter) {
			if (treeToFilter.children) {
				treeToFilter.children = treeToFilter.children
					.map(treeChild => recursiveFilterTree(treeChild))
					.filter(child => child !== undefined);
				if (treeToFilter.children.length === 0) {
					return undefined;
				}
			} else {
				treeToFilter = filterFn(treeToFilter);
			}
			return treeToFilter;
		}
		return recursiveFilterTree(treeToFilter);
	}
};

export default {
	components: {
		TestCaseState
	},
	name: 'file-tree',
	props: {
		item: Object,
		displayLink: Boolean,
		displaySelectors: Boolean
	},
	data: function () {
		return {
			isOpen: true
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
				this.isOpen = !this.isOpen;
			}
		}
	}
};
