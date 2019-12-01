'use strict';

const MongoClient = require('mongodb').MongoClient;

const mongoHost = process.env['MONGO_HOST'] || 'localhost';
const mongoPort = process.env['MONGO_PORT'] || 27017;

const mongoUrl = `mongodb://${mongoHost}:${mongoPort}`;
const defaultDbName = 'smctest';

const DB_TABLES = {
	USERS: 'users',
	TEST_SUITES: 'testSuites'
};

const client = new MongoClient(mongoUrl, {
	autoReconnect: true,
	reconnectTries: 5,
	reconnectInterval: 2000,
	useNewUrlParser: true
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

module.exports = {
	connect,
	getDb,
	getCollection,
	close,
	DB_TABLES
};
