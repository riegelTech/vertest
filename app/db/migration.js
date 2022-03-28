'use strict';

const path = require('path');

const compareVersion = require('compare-versions');

const dbConnector = require('./db-connector');
const logsModule = require('../logsModule/logsModule');
const utils = require('../utils');

const APPLICATION_METADATA_ID = 'application-metadata';

async function setMetadata() {
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.METADATA);
	const pjson = require(path.join(__dirname, '../../package.json'));

	const existingMetadata = await getMetadata();
	if (!existingMetadata) {
		await coll.insertOne({
			_id: APPLICATION_METADATA_ID,
			applicationVersion: pjson.version
		});
	} else {
		await coll.updateOne({_id: APPLICATION_METADATA_ID}, {
			$set: {
				applicationVersion: pjson.version
			}
		});
	}
}

async function getMetadata() {
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.METADATA);
	const cursor = await coll.find({});
	const itemsCount = await cursor.count();
	if (itemsCount > 0){
		return (await cursor.toArray())[0];
	}
	return null;
}


async function startMigration() {
	const logger = logsModule.getDefaultLoggerSync();
	const migrationDescriptor = JSON.parse(await utils.readFile(path.join(__dirname, './migrations/migration.json')));

	const pjson = require(path.join(__dirname, '../../package.json'));
	const metadata = await getMetadata();
	const dataVersion = metadata ? metadata.applicationVersion : '0.0.0';
	const applicationVersion = pjson.version;

	if (compareVersion.compare(applicationVersion, dataVersion, '<')) {
		logger.error(`Warning: you are running application in ${applicationVersion} version while data is in ${dataVersion} version. This case isn't supported, and is very likely to create bugs`);
		return;
	} else if (compareVersion.compare(applicationVersion, dataVersion, '=')) {
		return;
	}

	logger.info(`Starting migration of data from version ${dataVersion} to ${applicationVersion}`);
	const backup = await dbConnector.getTablesContent();
	await utils.writeFile(path.join(__dirname, '../../backup.json'), JSON.stringify(backup));
	logger.info('Backup wrote in file backup.json');

	async function migrationExecutionWrapper(migrationFunctionName, targetVersion, migrationFunction) {
		try {
			return migrationFunction();
		} catch (e) {
			const errorMsg = `Failed to migrate data from version ${dataVersion} to ${targetVersion}`;
			logger.error(errorMsg);
			logger.info(`${errorMsg}: try to restore the backup`);
			await dbConnector.replaceTablesContent(backup);
			logger.info(`${errorMsg}: backup successfully restored`);
			throw new Error(`${errorMsg}, rollback has been performed on data.`);
		}
	}

	for (let targetVersion in migrationDescriptor.migrations) {
		if (!migrationDescriptor.migrations.hasOwnProperty(targetVersion)) {
			continue;
		}
		if (compareVersion.compare(dataVersion, targetVersion, '<') && compareVersion.compare(applicationVersion, targetVersion, '>=')) {
			logger.info(`Execute data migrations of version ${targetVersion}`);
			const versionMigrationModule = require(`./migrations/${targetVersion}.js`);
			for (let migrationFunctionName of migrationDescriptor.migrations[targetVersion]) {
				await migrationExecutionWrapper(migrationFunctionName, targetVersion, versionMigrationModule[migrationFunctionName]);
			}
			logger.info(`Data migrations of version ${targetVersion} successfully finished`);
		}
	}

	await setMetadata();
	logger.info(`Data migrations successfully finished`);
}

module.exports = {
	startMigration
};