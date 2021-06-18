'use strict';

const MongoClient = require('mongodb').MongoClient;

const mongoHost = process.env['MONGO_HOST'] || 'localhost';
const mongoPort = process.env['MONGO_PORT'] || 27017;

const mongoUrl = `mongodb://${mongoHost}:${mongoPort}`;
const defaultDbName = 'vertest';

const DB_TABLES = {
	USERS: 'users',
	TEST_SUITES: 'testSuites',
	METADATA: 'metadata'
};

const client = new MongoClient(mongoUrl, {
	useUnifiedTopology: true
});

async function connect() {
	if (!client.isConnected()) {
		await client.connect();
	}
	return;
}

async function getDb(dbName = defaultDbName) {
	await connect();
	return client.db(dbName);
}

async function close() {
	await client.close();
}

async function getCollection(collName) {
	const db = await getDb();
	return db.collection(collName);
}

async function getTablesContent() {
	const result = {};
	for (let tableKey in DB_TABLES) {
		const tableName = DB_TABLES[tableKey];
		const coll = await getCollection(tableName);
		const cursor = await coll.find();
		const itemsCount = await cursor.count();
		if (itemsCount > 0) {
			result[tableName] = await cursor.toArray();
		} else {
			result[tableName] = [];
		}
	}
	return result;
}

async function replaceTablesContent(tablesContent) {
	for (let tableName in tablesContent) {
		let coll = await getCollection(tableName);
		await coll.drop();
		coll = await getCollection(tableName);
		coll.insertMany(tablesContent[tableName]);
	}
}

module.exports = {
	connect,
	getCollection,
	getTablesContent,
	replaceTablesContent,
	close,
	DB_TABLES
};
