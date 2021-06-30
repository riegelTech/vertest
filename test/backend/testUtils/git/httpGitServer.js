'use strict';

const bodyParser = require('body-parser');
const express = require('express');
const pktLine = require('git-pkt-line');

const gitCommands = require('./gitCommands');

let httpServer;
let log;

let corrupted = false;

async function sendRefs(res, gitRepository) {
	res.status(200);
	res.setHeader('Content-Type', 'application/x-git-upload-pack-advertisement');
	res.setHeader('Cache-Control', 'no-cache');
	await gitCommands.sendUploadPackRefs(res, gitRepository, ['# service=git-upload-pack', null], true);
}

async function createHttpServer({gitRepository = null, allowedUser = '', allowedPassword = '', debug = false}) {

	log = debug ? console.log : () => undefined;

	const app = express();
	app.use(express.json());
	app.use(bodyParser.raw({
		inflate: true,
		limit: '100kb',
		type: 'application/x-git-upload-pack-request'
	}));

	app.use((req, res, next) => {
		const auth = {
			login: allowedUser,
			password: allowedPassword
		};
		const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
		const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
		if (!auth.login || (login && password && login === auth.login && password === auth.password) || (login && !password && login === auth.login)) {
			return next()
		}

		// Access denied...
		res.set('WWW-Authenticate', 'Basic realm="401"');
		res.status(401).send('Authentication required.');
	});

	app.all('/*', async function (req, res) {
		if (req.method === 'GET') {
			await sendRefs(res, gitRepository);
		} else if (req.method === 'POST') {
			res.status(200);
			res.setHeader('Content-Type', 'application/x-git-upload-pack-result');
			res.setHeader('Cache-Control', 'no-cache');

			const wantedRefs = [];
			const lines = [];
			const decode = pktLine.deframer(function (type, value) {
				lines.push(value);
			});
			const encode = pktLine.framer(function (chunk) {
				res.write(chunk);
			});
			decode(req.body);
			lines.forEach(async line => {
				if (line && line.startsWith('want ')) {
					wantedRefs.push(line.substring(5, 45));
				}
			});

			const packBuffs = await gitCommands.getRefPack(gitRepository, wantedRefs);

			for(let ref of wantedRefs) {
				encode('line', `ACK ${ref}\n`);
				if (corrupted) {
					res.write(Buffer.alloc(1, 0, 'binary'));
				}
				res.write(packBuffs.get(ref));
			}
		}

		res.end();
	});

	return new Promise(res => {
		httpServer = app.listen(0, () => {
			res(httpServer.address());
			log('server started');
		});
	});
}

async function tearDownHttpServer() {
	return new Promise(res => {
		httpServer.close(function (err) {
			log('server closed');
			res();
		});
	});
}

function corruptGitServer() {
	corrupted = true;
}

function decorruptGitServer() {
	corrupted = false;
}

module.exports = {
	createHttpServer,
	tearDownHttpServer,
	corruptGitServer,
	decorruptGitServer
};