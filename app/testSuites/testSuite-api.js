'use strict';

const express = require('express');
const router = express.Router();

const dbConnector = require('../db/db-connector');
const testCasesImporter = require('./testCases-importer');
const TestSuite = require('./testSuite');

async function getColl() {
	const db = await dbConnector.getDb();
	return db.collection('testSuites');
}

async function getTestSuites(req, res) {
	const coll = await getColl();
	try {
		const cursor = await coll.find();
		const itemsCount = await cursor.count();
		let itemsList = [];
		if (itemsCount > 0){
			itemsList = await cursor.toArray();
		}
		res.send(itemsList.map(item => new TestSuite(item)));
	} catch(e) {
		res.send({
			success: false,
			msg: e.message
		});
	}
}

async function createTestSuite(req, res) {
	const coll = await getColl();
	try {
		const testSuite = new TestSuite(req.body);
		await coll.insertOne(testSuite);
		res.send({
			success: true,
			data: testSuite
		});
	} catch(e) {
		res.send({
			success: false,
			msg: e.message
		})
	}
}

async function deleteTestSuite(req, res) {
	const coll = await getColl();
	const testUuid = req.params.uuid;
	try {
		const filter = {_id: testUuid};
		const cursor = await coll.find(filter);
		const itemsCount = await cursor.count();
		if (itemsCount === 0) {
			throw new Error(`No test suite found with id ${testUuid}`);
		}
		const oldTestSuite = (await cursor.toArray())[0];
		await coll.deleteOne(filter);
		res.send({
			success: true,
			data: new TestSuite(oldTestSuite)
		});
	} catch (e) {
		res.send({
			success: false,
			msg: e.message
		})
	}
}

async function importTestCases(req, res) {
	const testUuid = req.params.uuid;
	const {gitRepoUrl, gitBranch, sourceDir} = req.body;
	const coll = await getColl();
	try {
		const testCases = await testCasesImporter(gitRepoUrl, gitBranch, sourceDir);
		const filter = {_id: testUuid};
		const cursor = await coll.find(filter);
		const itemsCount = await cursor.count();
		if (itemsCount === 0) {
			throw new Error(`No test suite found with id ${testUuid}`);
		}
		await coll.updateOne(filter, {
			$set: {
				tests: testCases
			}
		});

		const newCursor = await coll.find(filter);
		const newTestSuite = (await newCursor.toArray())[0];
		res.send({
			success: true,
			data: newTestSuite
		});
	} catch (e) {
		res.send({
			success: false,
			msg: e.message
		})
	}





}

router.get('/', getTestSuites)
	.post('/', createTestSuite)
	.put('/import-test-cases/:uuid', importTestCases)
	.delete('/:uuid', deleteTestSuite);


module.exports = router;