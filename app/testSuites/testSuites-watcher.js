'use strict';

const dbConnector = require('../db/db-connector');
const repoModule = require('../repositories/repositories');
const {TestSuite} = require('./testSuite');

const TEST_SUITE_COLL_NAME = 'testSuites';
const watchInterval = 5000;

async function watchTestSuitesChanges() {
	const coll = await dbConnector.getCollection(TEST_SUITE_COLL_NAME);
	const cursor = await coll.find();
	const itemsCount = await cursor.count();
	let itemsList = [];
	if (itemsCount > 0){
		itemsList = await cursor.toArray();
	}

	const testSuitesToWatch = itemsList
		.map(testSuiteProps => new TestSuite(testSuiteProps))
		.filter(testSuite => {
			try {
				return repoModule.getRepository(testSuite.repoAddress) && true;
			} catch (e) {
				return false
			}
		});

	setInterval(() => {
		testSuitesToWatch.forEach(async testSuite => {
			const repository = repoModule.getRepository(testSuite.repoAddress);
			try {
				await repository.fetchRepository();
				const newHeadSha = await repository.lookupForChanges(testSuite.gitBranch);
				if (newHeadSha && testSuite.status === TestSuite.STATUSES.UP_TO_DATE) {
					testSuite.status = TestSuite.STATUSES.TO_UPDATE;
					await coll.updateOne({_id: testSuite._id}, {$set: testSuite});
				}
			} catch (e) {
				if (e.code === 'EPRIVKEYENCRYPTED' || e.code === 'EDELETEDBRANCH') {
					return console.log(e.message);
				}
				throw e;
			}
		})
	}, watchInterval);
}

module.exports = {
	watchTestSuitesChanges
};
