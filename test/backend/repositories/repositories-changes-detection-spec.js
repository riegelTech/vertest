'use strict';

const Path = require('path');

const _ = require('lodash');
const chai = require('chai');
const dataDriven = require('data-driven');
const fsExtra = require('fs-extra');
const NodeGit= require('nodegit');
const {Branch, Checkout} = NodeGit;
const proxyquire = require('proxyquire');
const tmp = require('tmp-promise');
const uuid = require('uuidv4');

let repoModule = require('../../../app/repositories/repositories');
const Status = require('../../../app/testCase/testCaseStatuses').Status;
const utils = require('../../../app/utils');

chai.should();
const expect = chai.expect;

describe('Repository module: changes and detection', function () {

	let tmpSpace;
	let gitRepository;
	let repositoryPath;
	before(async function() {
		tmpSpace = await tmp.dir();
		repositoryPath = Path.join(tmpSpace.path, uuid.uuid());
	});
	after(async function () {
		await fsExtra.remove(tmpSpace.path);
	});

	beforeEach(async function () {
		await fsExtra.remove(repositoryPath);
		gitRepository = await NodeGit.Repository.init(repositoryPath, 0);
		await NodeGit.Repository.open(repositoryPath);
	});

	async function addContentToTestRepository(fileDir = null, fileName = 'testFile', fileContent = 'some data', commitMsg = 'Some new commit') {
		const dir = fileDir ? Path.join(repositoryPath, fileDir) : repositoryPath;
		const file = Path.join(dir, fileName);
		if (fileDir) {
			await fsExtra.mkdirp(dir);
		}

		await utils.writeFile(file, fileContent);
		const signatures = await gitRepository.defaultSignature();
		return gitRepository.createCommitOnHead([Path.join(fileDir ? fileDir : '', fileName)], signatures, signatures, commitMsg);
	}

	describe('refresh repository infos', function () {

		let repoTestPath;
		beforeEach(async function () {
			repoTestPath = Path.join(tmpSpace.path, 'repoTests', uuid.uuid());
			await fsExtra.mkdirp(repoTestPath);
		});

		afterEach(async function () {
			await fsExtra.remove(repoTestPath);
		});

		it('should refresh last commit sha', async function () {
			// given
			await addContentToTestRepository();
			// when
			const newRepo = new repoModule.Repository({
				name: 'some name',
				address: repositoryPath,
				repoPath: repoTestPath
			});
			const currentBranch = 'master';
			await newRepo.init({forceInit: true, waitForClone: true});
			const lastCommit = await newRepo.getRecentCommitOfBranch(currentBranch);
			// when
			await addContentToTestRepository(null, 'otherTestFile', 'some other data', 'Some new commit');
			(await newRepo.getRecentCommitOfBranch('master')).should.eql(lastCommit);
			// and
			await newRepo.fetchRepository();
			// then
			(await newRepo.getRecentCommitOfBranch('master')).should.not.eql(lastCommit);
		});

		it('should detect a GIT branch removal throwing an error', async function () {
			// given
			const branchNameToDelete = 'some-branch';
			await addContentToTestRepository();
			const oid = await addContentToTestRepository(null, 'otherTestFile', 'some other data', 'Some new commit');
			let branchToDelete = await gitRepository.createBranch(branchNameToDelete, oid, false);
			const newRepo = new repoModule.Repository({
				name: 'some name',
				address: repositoryPath,
				repoPath: repoTestPath
			});
			await newRepo.init({forceInit: true, waitForClone: true});
			await newRepo.checkoutBranch(branchNameToDelete);
			// when
			const masterBranch = await gitRepository.getBranch('master');
			await gitRepository.checkoutRef(masterBranch, {
				checkoutStrategy: Checkout.STRATEGY.FORCE
			});
			// when
			Branch.delete(branchToDelete);
			await newRepo.refreshAvailableGitBranches();

			return newRepo.lookupForChanges([repoModule.Repository.CATCH_ALL_FILES_PATTERN]).should.eventually.be.rejectedWith(`Branch "${branchNameToDelete}" seems to be remotely deleted on repository "${newRepo.name}"`);
		});

		it('should generate a GIT log', async function () {
			// given
			const commits = [];
			const nbCommits = 5;
			await addContentToTestRepository();
			for(let i = 1, j = nbCommits; i <= j; i++) {
				const oid = await addContentToTestRepository(null, `otherTestFile-${i}`, 'some other data', `Some new commit-${i}`);
				commits.push(await gitRepository.getCommit(oid));
			}
			const newRepo = new repoModule.Repository({
				name: 'some name',
				address: repositoryPath,
				repoPath: repoTestPath
			});
			await newRepo.init({forceInit: true, waitForClone: true});
			// when
			const gitLog = await newRepo.getGitLog(nbCommits);
			gitLog.map(commit => commit.sha()).should.deep.eql(_.reverse(commits.map(commit => commit.sha())));
		});

		it('Should not fail if try to generate a longer git log than the repository contains', async function () {
			// given
			const commits = [];
			const nbCommits = 3;
			const limit = nbCommits + 5;
			for(let i = 1, j = nbCommits; i <= j; i++) {
				const oid = await addContentToTestRepository(null, `otherTestFile-${i}`, 'some other data', `Some new commit-${i}`);
				commits.push(await gitRepository.getCommit(oid));
			}
			const newRepo = new repoModule.Repository({
				name: 'some name',
				address: repositoryPath,
				repoPath: repoTestPath
			});
			await newRepo.init({forceInit: true, waitForClone: true});
			// when
			expect(async () => await newRepo.getGitLog(limit)).to.not.throw();
		});

		describe('should determine if a patch is filtered by the file selectors', function () {
			dataDriven([{
				msg: 'with simple selection',
				selectors: [
					'**/**.test'
				],
				patches: [{
					newFile: 'some-dir/some-file.test',
					oldFile: 'some-dir/some-file.test'
				}, {
					newFile: 'some-dir/some-file.notest',
					oldFile: 'some-dir/some-file.notest'
				}],
				expectedResults: [{
					withWholePatch: true,
					withNewFilesOnly: true,
					withOldFilesOnly: true
				}, {
					withWholePatch: false,
					withNewFilesOnly: false,
					withOldFilesOnly: false
				}]
			}, {
				msg: 'with simple selection and negative selectors',
				selectors: [
					'!**/**.test'
				],
				patches: [{
					newFile: 'some-dir/some-file.test',
					oldFile: 'some-dir/some-file.test'
				}, {
					newFile: 'some-dir/some-file.notest',
					oldFile: 'some-dir/some-file.notest'
				}],
				expectedResults: [{
					withWholePatch: false,
					withNewFilesOnly: false,
					withOldFilesOnly: false
				}, {
					withWholePatch: false, // note that negative selectors means "all the previous selected files except those matching..."
					withNewFilesOnly: false,
					withOldFilesOnly: false
				}]
			}, {
				msg: 'with simple selection, matching only new file',
				selectors: [
					'**/**.test'
				],
				patches: [{
					newFile: 'some-dir/some-file.notest',
					oldFile: 'some-dir/some-file.test'
				}],
				expectedResults: [{
					withWholePatch: true,
					withNewFilesOnly: false,
					withOldFilesOnly: true
				}]
			}, {
				msg: 'with multiple selection, and positive selectors',
				selectors: [
					'**/**.foo',
					'**/**.bar'
				],
				patches: [{
					newFile: 'some-dir/some-file.foo',
					oldFile: 'some-dir/some-file.foo'
				}, {
					newFile: 'some-dir/some-file.bar',
					oldFile: 'some-dir/some-file.bar'
				}, {
					newFile: 'some-dir/some-file.foobar',
					oldFile: 'some-dir/some-file.foobar'
				}],
				expectedResults: [{
					withWholePatch: true,
					withNewFilesOnly: true,
					withOldFilesOnly: true
				}, {
					withWholePatch: true,
					withNewFilesOnly: true,
					withOldFilesOnly: true
				}, {
					withWholePatch: false,
					withNewFilesOnly: false,
					withOldFilesOnly: false
				}]
			}, {
				msg: 'with multiple selection, and negative selectors',
				selectors: [
					'**/**.foo',
					'!**/bar/**.foo'
				],
				patches: [{
					newFile: 'some-dir/some-file.foo',
					oldFile: 'some-dir/some-file.foo'
				}, {
					newFile: 'bar/some-file.foo',
					oldFile: 'bar/some-file.foo'
				}, {
					newFile: 'some-dir/some-file.foobar',
					oldFile: 'some-dir/some-file.foobar'
				}],
				expectedResults: [{
					withWholePatch: true,
					withNewFilesOnly: true,
					withOldFilesOnly: true
				}, {
					withWholePatch: false,
					withNewFilesOnly: false,
					withOldFilesOnly: false
				}, {
					withWholePatch: false,
					withNewFilesOnly: false,
					withOldFilesOnly: false
				}]
			}], () => {
				it('{msg}', async function (ctx) {
					// given
					const patches = ctx.patches.map(patch => ({
						newFile: () => ({
							path: () => patch.newFile
						}),
						oldFile: () => ({
							path: () => patch.oldFile
						})
					}));

					ctx.expectedResults.forEach((expectedResult, index) => {
						const wholePatchResult = repoModule.Repository.patchMatchTest(patches[index], ctx.selectors).globalMatch;
						const newFileOnlyResult = repoModule.Repository.patchMatchTest(patches[index], ctx.selectors).newFileMatch;
						const oldFileOnlyResult = repoModule.Repository.patchMatchTest(patches[index], ctx.selectors).oldFileMatch;

						// expect
						wholePatchResult.should.eql(expectedResult.withWholePatch);
						newFileOnlyResult.should.eql(expectedResult.withNewFilesOnly);
						oldFileOnlyResult.should.eql(expectedResult.withOldFilesOnly);
					});
				});
			})
		});

		describe('should detect or not changes in repository', function () {

			async function commitFilesManually(gitRepository, filesToDelete = [], filesToAdd = []) {
				const signatures = await gitRepository.defaultSignature();
				const curRepoIndex = await gitRepository.refreshIndex();
				for (let fileToDelete of filesToDelete) {
					await curRepoIndex.removeByPath(fileToDelete);
				}
				for (let fileToAdd of filesToAdd) {
					await curRepoIndex.addByPath(fileToAdd);
				}

				await curRepoIndex.write();
				const oid = await curRepoIndex.writeTree();
				const head = await NodeGit.Reference.nameToId(gitRepository, "HEAD");
				const parent = await gitRepository.getCommit(head);
				await gitRepository.createCommit("HEAD", signatures, signatures, 'Some commit', oid, [parent]);
			}

			function cleanDiffFromUnpredictableKeys(diff) {
				const cleanedDiff = Object.assign({}, diff);
				function cleanPatch(patch) {
					return _.pick(patch, ['file', 'newFile']);
				}

				cleanedDiff.modifiedPatches = diff.modifiedPatches.map(cleanPatch);
				cleanedDiff.addedPatches = diff.addedPatches.map(cleanPatch);
				cleanedDiff.deletedPatches = diff.deletedPatches.map(cleanPatch);
				cleanedDiff.renamedPatches = diff.renamedPatches.map(cleanPatch);
				return _.omit(cleanedDiff, ['currentCommit', 'targetCommit']);
			}

			const mockedTestCase = {
				someTestKey: 'some test value',
				getIncludedFilesFlat: () => ['some/file']
			};

			dataDriven([{
				msg: 'successfully with file addition',
				initialCommit: {
				},
				addition: {
					dir: 'someDirectory',
					file: 'someDirectory/someNewFile.test',
					fileContent: 'Some new file content'
				},
				detectionFilter: ['**/someDirectory/**.test'],
				detection: true,
				expectedDiff: {
					isEmpty: false,
					addedPatches: [{ file: 'someDirectory/someNewFile.test' }],
					deletedPatches: [],
					modifiedPatches: [],
					renamedPatches: []
				}
			}, {
				msg: 'successfully with file deletion',
				initialCommit: {
					dir: 'someDirectory',
					file: 'someNewFile.test',
					fileContent: 'Some file content'
				},
				deletion: {
					file: 'someDirectory/someNewFile.test'
				},
				detectionFilter: ['**/someDirectory/**.test'],
				detection: true,
				expectedDiff: {
					isEmpty: false,
					addedPatches: [],
					deletedPatches: [{ file: 'someDirectory/someNewFile.test' }],
					modifiedPatches: [],
					renamedPatches: []
				}
			}, {
				msg: 'successfully with file modification',
				initialCommit: {
					dir: 'someDirectory',
					file: 'someNewFile.test',
					fileContent: 'Some file content'
				},
				addition: {
					dir: 'someDirectory',
					file: 'someDirectory/someNewFile.test',
					fileContent: 'Some new file content'
				},
				detectionFilter: ['**/someDirectory/**.test'],
				detection: true,
				expectedDiff: {
					isEmpty: false,
					addedPatches: [],
					deletedPatches: [],
					modifiedPatches: [{
						file: 'someDirectory/someNewFile.test',
						newFile: 'someDirectory/someNewFile.test'
					}],
					renamedPatches: []
				}
			}, {
				msg: 'no detection without test file matching',
				initialCommit: {
					dir: 'someDirectory',
					file: 'someNewFile.test',
					fileContent: 'Some file content'
				},
				addition: {
					dir: 'someDirectory',
					file: 'someDirectory/someNewFile.test',
					fileContent: 'Some new file content'
				},
				detectionFilter: ['**/nonExistantDirectory/**.test'],
				detection: false,
				expectedDiff: {
					isEmpty: true,
					addedPatches: [],
					deletedPatches: [],
					modifiedPatches: [],
					renamedPatches: []
				}
			}, {
				msg: 'no detection without modification',
				initialCommit: {
					dir: 'someDirectory',
					file: 'someNewFile.test',
					fileContent: 'Some file content'
				},
				detectionFilter: ['**/nonExistantDirectory/**.test'],
				detection: false,
				expectedDiff: {
					isEmpty: true,
					addedPatches: [],
					deletedPatches: [],
					modifiedPatches: [],
					renamedPatches: []
				}
			}, {
				msg: 'successfully when a file moves from a non-matching point to a matching point',
				initialCommit: {
					dir: 'someDirectory',
					file: 'someNewFile.notest',
					fileContent: 'Some file content'
				},
				move: {
					from: 'someDirectory/someNewFile.notest',
					to: 'someDirectory/someNewFile.test'
				},
				detectionFilter: ['**/someDirectory/**.test'],
				detection: true,
				expectedDiff: {
					isEmpty: false,
					addedPatches: [{
						file: 'someDirectory/someNewFile.notest',
						newFile: 'someDirectory/someNewFile.test'
					}],
					deletedPatches: [],
					modifiedPatches: [],
					renamedPatches: [{
						file: 'someDirectory/someNewFile.notest',
						newFile: 'someDirectory/someNewFile.test'
					}]
				}
			}, {
				msg: 'successfully when a file moves from a matching point to a non-matching point',
				initialCommit: {
					dir: 'someDirectory',
					file: 'someNewFile.test',
					fileContent: 'Some file content'
				},
				move: {
					from: 'someDirectory/someNewFile.test',
					to: 'someDirectory/someNewFile.notest'
				},
				detectionFilter: ['**/someDirectory/**.test'],
				detection: true,
				expectedDiff: {
					isEmpty: false,
					addedPatches: [],
					deletedPatches: [{
						file: 'someDirectory/someNewFile.test',
						newFile: 'someDirectory/someNewFile.notest'
					}],
					modifiedPatches: [],
					renamedPatches: []
				}
			}], () => {
				it('{msg}', async function (ctx) {
					// given
					await addContentToTestRepository(ctx.initialCommit.dir, ctx.initialCommit.file, ctx.initialCommit.fileContent);
					const newRepo = new repoModule.Repository({
						name: 'some name',
						address: repositoryPath,
						repoPath: repoTestPath
					});
					await newRepo.init({forceInit: true, waitForClone: true});
					// when

					if (ctx.addition) {
						if (ctx.addition.dir) {
							await fsExtra.mkdirp(Path.join(repositoryPath, ctx.addition.dir));
						}
						if (ctx.addition.file) {
							await utils.writeFile(Path.join(repositoryPath, ctx.addition.file), ctx.addition.fileContent || '');
							await commitFilesManually(gitRepository, [], [ctx.addition.file]);
						}
					}

					if (ctx.move) {
						const from = Path.join(repositoryPath, ctx.move.from);
						const to = Path.join(repositoryPath, ctx.move.to);
						await utils.renameFile(from, to);
						await commitFilesManually(gitRepository, [ctx.move.from], [ctx.move.to]);
					}
					if (ctx.deletion && ctx.deletion.file) {
						await commitFilesManually(gitRepository, [ctx.deletion.file]);
					}
					// and
					await newRepo.fetchRepository();
					// then
					const detectedChanges = await newRepo.lookupForChanges(ctx.detectionFilter);
					detectedChanges.should.eql(ctx.detection);

					const upstreamCommit = await newRepo.getRecentCommitOfBranch(newRepo._curBranch);
					const mockedTestSuite = {
						testDirs: ctx.detectionFilter,
						getTestCaseByFilePath: () => mockedTestCase,
						tests: [mockedTestCase]
					};
					const diff = await newRepo.getRepositoryDiff(mockedTestSuite, upstreamCommit);
					cleanDiffFromUnpredictableKeys(diff).should.deep.eql(ctx.expectedDiff);
				});
			});
		});

		describe('should detect changes in files that are included in each others', function () {
			const statusMock = new Status({
				name: 'default',
				isDefaultStatus: true,
				testCaseIsDone: false
			});
			const testSuiteModule = proxyquire('../../../app/testSuites/testSuite', {
				'../testCase/testCaseStatuses': {
					getStatuses: () => {
						return {
							getStatusByIndex: () => statusMock
						};
					}
				}
			});
			const TestSuite = testSuiteModule.TestSuite;
			const newLineChange = 'New Line at the end of file';

			async function initRepoWithFiles(baseDir, files) {
				const gitFiles = [];
				for(let file of files) {
					await fsExtra.copy(Path.join(baseDir, file), Path.join(repositoryPath, file));
					gitFiles.push(file);
				}
				const signatures = await gitRepository.defaultSignature();
				return gitRepository.createCommitOnHead(gitFiles, signatures, signatures, 'initial commit');
			}

			async function makeChangeOnMDfile(baseDir, files) {
				const gitFiles = [];
				for(let file of files) {
					const filePath = Path.join(repositoryPath, file);
					const fileContent = await utils.readFile(filePath);
					await utils.writeFile(filePath, `${fileContent}\n${newLineChange}\n`);
					gitFiles.push(file);
				}
				const signatures = await gitRepository.defaultSignature();
				return gitRepository.createCommitOnHead(gitFiles, signatures, signatures, 'second commit');
			}

			dataDriven([{
				msg: 'with regular files',
				files: [
					'regular.md',
					'a/a1.md',
					'a/b/b1.md',
					'a/b/c/c1.md'
				],
				changes: [
					'regular.md',
					'a/b/c/c1.md'
				],
				fileSelector: [
					'regular.md'
				],
				expectedModifiedPatchesWithInclusion: [{
					file: 'a/b/c/c1.md',
					newFile: 'a/b/c/c1.md',
					hunks: [{
						existingLines: undefined,
						newLines: {start: 6, numLines: 2, content: ['', newLineChange]},
						oldLines: {start: 3, numLines: 0, content: []},
						hunks: [{
							existingLines: {start: 3, numLines: 1, content: ['!!!include(b/b1.md)!!!']},
							newLines: undefined,
							oldLines: undefined,
							hunks: [{
								existingLines: {start: 3, numLines: 1, content: ['!!!include(c/c1.md)!!!']},
								newLines: undefined,
								oldLines: undefined,
								hunks: [{
									existingLines: undefined,
									newLines: {start: 2, numLines: 2, content: ['', newLineChange]},
									oldLines: {start: 1, numLines: 0, content: []},
									hunks: []
								}]
							}]
						}]
					}]
				}, {
					file: 'regular.md',
					newFile: 'regular.md',
					hunks: [{
						existingLines: undefined,
						newLines: {start: 6, numLines: 2, content: ['', newLineChange]},
						oldLines: {start: 3, numLines: 0, content: []},
						hunks: [{
							existingLines: {start: 3, numLines: 1, content: ['!!!include(b/b1.md)!!!']},
							newLines: undefined,
							oldLines: undefined,
							hunks: [{
								existingLines: {start: 3, numLines: 1, content: ['!!!include(c/c1.md)!!!']},
								newLines: undefined,
								oldLines: undefined,
								hunks: [{
									existingLines: undefined,
									newLines: {start: 2, numLines: 2, content: ['', newLineChange]},
									oldLines: {start: 1, numLines: 0, content: []},
									hunks: []
								}]
							}]
						}]
					}]
				}],
				expectedModifiedPatchesWithoutInclusion: [{
					file: 'regular.md',
					newFile: 'regular.md',
					hunks: [{
						newLines: {start: 6, numLines: 2, content: ['', newLineChange]},
						oldLines: {start: 3, numLines: 0, content: []},
						hunks: []
					}]
				}]
			}], () => {
				it('{msg}', async function (ctx) {
					// given
					const baseDir = Path.resolve(__dirname, '../fixtures/inclusion');
					await initRepoWithFiles(baseDir, ctx.files);
					const newRepo = new repoModule.Repository({
						name: 'some name',
						address: repositoryPath,
						repoPath: repoTestPath
					});
					await newRepo.init({forceInit: true, waitForClone: true});
					const testSuite = new TestSuite({
						name: 'some test suite',
						repository: newRepo,
						testDirs: ctx.fileSelector
					})
					await testSuite.init();
					await makeChangeOnMDfile(baseDir, ctx.changes);
					// when
					await newRepo.fetchRepository();
					const repositoryHasChanged = await newRepo.lookupForChanges(testSuite.testDirs);
					// then
					repositoryHasChanged.should.be.true;
					// when
					const mostRecentCommit = await newRepo.getRecentCommitOfBranch('master');
					const changesWithIncludedFiles = await newRepo.getRepositoryDiff(testSuite, mostRecentCommit);
					const changesWithoutIncludedFiles = await newRepo.getRepositoryDiff(testSuite, mostRecentCommit, false);

					const patchesWithIncludedFiles = changesWithIncludedFiles.modifiedPatches.map(patch => _.omit(patch, ['test']));
					const patchesWithoutIncludedFiles = changesWithoutIncludedFiles.modifiedPatches.map(patch => _.omit(patch, ['test']));
					// then
					patchesWithIncludedFiles.should.deep.eql(ctx.expectedModifiedPatchesWithInclusion);
					patchesWithoutIncludedFiles.should.deep.eql(ctx.expectedModifiedPatchesWithoutInclusion);
				});
			})
		});

		describe('should generate a diff for test suite file selector change', function () {

			let globMockResponse = [];

			beforeEach(function () {

				const globMock = () => globMockResponse;

				repoModule = proxyquire('../../../app/repositories/repositories', {
					'../utils': {
						glob: globMock
					}
				});
			});

			it('resulting a diff instance', async function () {
				// given
				globMockResponse = [
					'some-dir/some-file.test',
					'some-dir/another-file.test',
					'some-dir/not-a-test-file.notest'
				];
				const mockedTestSuite = {
					testDirs: [
						'**/**.test',
						'!**/**.notest'
					],
					getTestCaseByFilePath() {
						return {}
					}
				};
				const newFileSelectors = [
					'**/**.notest',
					'!**/**.test'
				];
				const repo = new repoModule.Repository({
					name: 'some name',
					address: repositoryPath,
					repoPath: repositoryPath
				});
				repo.getCurrentCommit = async function () {
					return {
						sha() {
							return 'some-commit-sha'
						}
					}
				};
				// when
				const diff = await repo.getRepositoryFilesDiff(mockedTestSuite, newFileSelectors);
				// then
				diff.constructor.should.eql(repoModule.TestSuiteDiff);
				diff.addedPatches.should.eql([{
					file: 'some-dir/not-a-test-file.notest', test: {}
				}]);
				diff.deletedPatches.should.eql([{
					file: 'some-dir/some-file.test', test: {}
				}, {
					file: 'some-dir/another-file.test', test: {}
				}]);
			});
		});

		describe('TestSuiteDiff class', function () {
			it('should instantiate a TestSuiteDiff', function () {
				// when
				const diff = new repoModule.TestSuiteDiff({});
				// then
				diff.isEmpty.should.be.true;
			});
			it('should not be empty if one of the diff entry is not empty', function () {
				// when
				const diff = new repoModule.TestSuiteDiff({addedPatches: ['some-patch']});
				// then
				diff.isEmpty.should.be.false;
			});
		});
	});
});