'use strict';


const fs = require('fs');
const crypto = require('crypto');

const pktLine = require('git-pkt-line');
const ssh2 = require('ssh2');
const ssh2Utils = ssh2.utils;

const gitCommands = require('./gitCommands');

let sshServer;
let log;
async function createSshServer({gitRepository = null, allowedUser = '', allowedPassword = '', allowedPubKeyPath = '', sshServerKey = '', debug = false}) {
	const allowedPubKey = ssh2Utils.parseKey(fs.readFileSync(allowedPubKeyPath));
	const sshUser = Buffer.from(allowedUser);
	const sshPass = Buffer.from(allowedPassword);

	log = debug ? console.log : () => undefined;

	sshServer = new ssh2.Server({
		hostKeys: [fs.readFileSync(sshServerKey)],
		authMethod: 'publickey'
	}, function(client) {
		log('client connection');
		let tries = 0;
		client.on('authentication', function(ctx) {
			log(`client start authentication with user ${ctx.username} and method ${ctx.method}`);
			if (tries > 2) {
				return ctx.reject();
			}
			tries ++;
			const user = Buffer.from(ctx.username);
			if (user.length !== sshUser.length
				|| !crypto.timingSafeEqual(user, sshUser)) {
				return ctx.reject();
			}
			switch (ctx.method) {
				case 'password':
					const password = Buffer.from(ctx.password);
					if (password.length !== sshPass.length
						|| !crypto.timingSafeEqual(password, sshPass)) {
						return ctx.reject();
					}
					break;
				case 'publickey':
					const allowedPubSSHKey = allowedPubKey.getPublicSSH();
					if (ctx.key.algo !== allowedPubKey.type
						|| ctx.key.data.length !== allowedPubSSHKey.length
						|| !crypto.timingSafeEqual(ctx.key.data, allowedPubSSHKey)
						|| (ctx.signature && allowedPubKey.verify(ctx.blob, ctx.signature) !== true)) {
						return ctx.reject();
					}
					break;
				default:
					return ctx.reject(['publickey', 'password']);
			}
			ctx.accept();
		}).on('ready', function() {
			log('client ready');
			client.on('session', function(accept, reject) {
				const session = accept();
				session.on('exec', async function(accept, reject, info) {
					log(`client wants to execute: ${info.command}`);
					const stream = accept();
					if (info.command.startsWith('git-upload-pack')) {
						await gitCommands.sendUploadPackRefs(stream, gitRepository);
						stream.on('data', async function(chunk) {
							const wantedRefs = [];
							const lines = [];
							const decode = pktLine.deframer(function (type, value) {
								lines.push(value);
							});
							const encode = pktLine.framer(function (chunk) {
								stream.write(chunk);
							});
							decode(chunk);
							lines.forEach(async line => {
								if (!line) {
									return;
								}
								if (line.startsWith('want ')) {
									wantedRefs.push(line.substring(5, 45));
								}
								if (line === 'done\n') {
									encode('line', 'NAK\n');
									const packs = await gitCommands.getRefPack(gitRepository, wantedRefs);
									for (let ref of wantedRefs) {
										encode('pack', packs.get(ref));
										encode('line', null);
									}
								}
								if (line.startsWith('flush-pkt')) {
									stream.exit(0);
									stream.end();
								}
							});
						});
					}

				});
			});
		}).on('end', function() {
			log('client disconnected');
		});
	});

	return new Promise(res => {
		sshServer.listen(0, '127.0.0.1', function() {
			log(`server started on port ${this.address().port}`);
			res(this.address().port);
		});
	});
}

async function tearDownSshServer() {
	return new Promise(res => {
		sshServer.close(function (err) {
			log('server closed');
			res();
		});
	});
}

module.exports = {
	createSshServer,
	tearDownSshServer
};
