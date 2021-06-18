'use strict';

const path = require('path');

const dbConnector = require('./db/db-connector');

async function setMetadata() {
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.METADATA);
	const pjson = require(path.join(__dirname, '../package.json'));
	await coll.insertOne({
		applicationVersion: pjson.version
	});
}


async function startMigration() {
	await setMetadata();
}

module.exports = {
	startMigration
};