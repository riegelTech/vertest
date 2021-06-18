'use strict';

const path = require('path');

const dbConnector = require('./db/db-connector');

const APPLICATION_METADATA_ID = 'application-metadata';

async function setMetadata() {
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.METADATA);
	const pjson = require(path.join(__dirname, '../package.json'));

	const existingMetadata = await getMetadata();
	if (!existingMetadata) {
		await coll.insertOne({
			_id: APPLICATION_METADATA_ID,
			applicationVersion: pjson.version
		});
	} else {
		await coll.updateOne({_id: APPLICATION_METADATA_ID}, {
			$set: { applicationVersion: pjson.version }
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
	await setMetadata();
}

module.exports = {
	startMigration
};