'use strict';

import {TEST_CASE_STATUSES} from '../pages/test-case/test-case';
import TestCaseState from './testCaseState.vue';
import Path from "path";

export const fileTreeUtils = {
	buildTree(filePaths, baseDir) {

		const shortenedFilePaths = filePaths.map(filePath => {
			const shortenedFilePath = filePath.replace(baseDir, '');
			const filePathSplit = shortenedFilePath.split(Path.sep);
			return {
				splitPath: filePathSplit.length === 1 ? filePathSplit : filePathSplit.slice(1),
				fullPath: filePath
			};
		});

		function buildTreeRecursive(filePaths) {
			const tree = [];
			for (let filePath of filePaths) {
				if (!filePath.splitPath[0]) {
					continue;
				}
				const dir = filePath.splitPath[0];
				if (!tree.find(existingDir => existingDir.name === dir)) {
					const sameDirs = filePaths.filter(testPath => testPath.splitPath[0] === dir);
					const children = buildTreeRecursive(sameDirs.map(sameDir => ({
						splitPath: sameDir.splitPath.slice(1),
						fullPath: sameDir.fullPath,
					})));
					tree.push({
						name: dir,
						path: filePath.splitPath.length > 1 ? '' : filePath.fullPath,
						fullPath: filePath.fullPath,
						children: children.length ? children : null
					});
				}
			}
			return tree;
		}

		return {
			name: 'root',
			path: baseDir,
			children: buildTreeRecursive(shortenedFilePaths)
		};
	},
	flattenLeafs(tree) {
		let flat = [];
		this.leafTransformer(tree, treeSegment => {
			flat.push(treeSegment);
		});
		return flat;
	},
	leafTransformer(treeToTransform, transformFn) {
		function recursiveTransformTree(treeToTransform) {
			let tree = Object.assign({}, treeToTransform);
			if (tree.children) {
				tree.children = tree.children.map(treeChild => recursiveTransformTree(treeChild));
			} else {
				tree = transformFn(tree);
			}
			return tree;
		}
		return recursiveTransformTree(treeToTransform);
	}
};

export default {
	components: {
		TestCaseState
	},
	name: 'file-tree',
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