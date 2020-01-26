'use strict';

const repoModule = require('../repositories/repositories');
const testSuitesModule = require('./testSuite');

const watchInterval = 5000;

async function watchTestSuitesChanges() {

	setInterval(async () => {
		await Promise.all(repoModule.getTrackingRepositories().map(async repository => {
			try {
				await repository.fetchRepository();
				await repository.refreshAvailableGitBranches();
			} catch (e) {
				if (e.code === 'EPRIVKEYENCRYPTED') {
					return console.log(e.message);
				}
				throw e;
			}
		}));

		const testSuites = await testSuitesModule.getTestSuites();
		await Promise.all(testSuites.map(async testSuite => {
			try {
				await testSuite.repository.fetchRepository();
				const newHeadSha = await testSuite.repository.lookupForChanges(testSuite.gitBranch);
				if (newHeadSha && testSuite.status === testSuitesModule.TestSuite.STATUSES.UP_TO_DATE) {
					testSuite.status = testSuitesModule.TestSuite.STATUSES.TO_UPDATE;
					await testSuitesModule.updateTestSuite(testSuite);
				}
			} catch (e) {
				if (e.code === 'EDELETEDBRANCH') {
					testSuite.status = testSuitesModule.TestSuite.STATUSES.TO_TOGGLE_BRANCH;
					await testSuitesModule.updateTestSuite(testSuite);
					await testSuite.repository.refreshAvailableGitBranches();
					return;
				}
			}
		}));
	}, watchInterval);
}

module.exports = {
	watchTestSuitesChanges
};
