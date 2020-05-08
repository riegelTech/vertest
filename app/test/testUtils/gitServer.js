'use strict';


const fs = require('fs');
const crypto = require('crypto');
const Path = require('path');
const {deflate} = require('zlib');
const util = require('util');

const bops = require('bops');
const fsextra = require('fs-extra');
const NodeGit = require('nodegit');
const pktLine = require('git-pkt-line');
const ssh2 = require('ssh2');
const ssh2Utils = ssh2.utils;

const utils = require('../../utils');

const deflatePromise = util.promisify(deflate);

function toBinary(str, nbBits = 8) {
	return [...str].map(v => v.charCodeAt().toString(2).padStart(nbBits, 0));
}

function binToHex(strBin) {
	return parseInt(strBin, 2).toString(16);
}

function setBits(buffer, i, startBit, values) {
	for(const value of values) {
		setBit(buffer, i, startBit++, value);
	}
}
function setBit(buffer, i, bit, value){
	if(value == 0){
		buffer[i] &= ~(1 << bit);
	}else{
		buffer[i] |= (1 << bit);
	}
}

function readBits(buffer, i, startBit, length) {
	const bits = [];
	for(let curBit = startBit; curBit < startBit + length; curBit++) {
		bits.push(readBit(buffer, i, curBit));
	}
	return bits;
}

function readBit(buffer, i, bit){
	return (buffer[i] >> bit) % 2;
}

async function sendRefPack(stream, gitRepository, references) {
	const pkline = pktLine.framer(function (chunk) {
		stream.write(chunk);
	});
	const packDirPath = './packfiles/';
	for (const reference of references) {
		////
		const oids = [];
		const commit = await gitRepository.getCommit(reference);
		const treeOid = commit.treeId().tostrS();
		oids.push(commit.sha(), treeOid);
		const tree = await gitRepository.getTree(treeOid);
		const treeIds = [treeOid].concat((await new Promise((res, rej) => {
			tree.walk(false)
				.on('end', res)
				.on('error', rej)
				.start();
		})).map(treeEntry => treeEntry.oid()));
		oids.push(...treeIds);

		oids.sort();
		const odb = await gitRepository.odb();

		// TODO throw error if there is more than 9999 references to write
		const headerBuf = Buffer.alloc(12);
		headerBuf.write('PACK');
		headerBuf.writeUInt32BE(2, 4);
		headerBuf.writeUInt32BE(oids.length, 8);

		let bodyBuf = Buffer.alloc(0);

		for(const oid of oids) {
			const odbObj = await odb.read(oid);
			const objData = odbObj.toString();
			const objSize = Buffer.byteLength(objData);

			let headerBitsSize = 4;
			let lengthBitsSize = 4;
			while ((2 ** lengthBitsSize) < objSize) {
				lengthBitsSize += 7;
				headerBitsSize += 1;
			}
			const headerSize = (lengthBitsSize + headerBitsSize) / 8;
			const headerObjBuf = Buffer.alloc(headerSize);

			switch (odbObj.type()) {
				case NodeGit.Object.TYPE.COMMIT:
					setBits(headerObjBuf, 0, 1, [0,0,1]);
					break;
				case NodeGit.Object.TYPE.TREE:
					setBits(headerObjBuf, 0, 1, [0,1,0]);
					break;
				case NodeGit.Object.TYPE.BLOB:
					setBits(headerObjBuf, 0, 1, [0,1,1]);
					break;
				case NodeGit.Object.TYPE.TAG:
					setBits(headerObjBuf, 0, 1, [1,0,0]);
					break;
				case NodeGit.Object.TYPE.OFS_DELTA:
					setBits(headerObjBuf, 0, 1, [1,1,0]);
					break;
				case NodeGit.Object.TYPE.REF_DELTA:
					setBits(headerObjBuf, 0, 1, [1,1,1]);
					break;
			}

			console.log('objSize', objSize);
			//console.log('lengthBitSize', lengthBitsSize, 2 ** lengthBitsSize);
			let sizeBin = objSize.toString(2);
			sizeBin = sizeBin.padStart(lengthBitsSize, '0');

			//console.log('sizebin', sizeBin);

			setBits(headerObjBuf, 0, 4, sizeBin.substring(sizeBin.length - 4).split('').map(ch => parseInt(ch)));
			if (objSize < 16) {
				setBit(headerObjBuf, 0, 0, 0);
			} else {
				setBit(headerObjBuf, 0, 0, 1);
				let restOfSizeBits = sizeBin.slice(0, -4);
				let curByteIndex = 1;
				while (restOfSizeBits.length > 0) {
					if (restOfSizeBits.length === 7) { // last chunk
						setBit(headerObjBuf, curByteIndex, 0, 0);
					} else {
						setBit(headerObjBuf, curByteIndex, 0, 1);
					}
					setBits(headerObjBuf, curByteIndex, 1, restOfSizeBits.slice(0,7).split('').map(ch => parseInt(ch)));
					curByteIndex ++;
					restOfSizeBits = restOfSizeBits.slice(7);
				}
			}

			console.log('type : ', odbObj.type());
			console.log('obj bytes');
			for(let i = 0; i < headerSize; i++) {
				console.log(readBits(headerObjBuf, i, 0, 8).join(' '));
			}
			const dataBuf = Buffer.from(odbObj.toString());
			const compressedDataBuf = await deflatePromise(dataBuf);
			console.log('odbObj in binary', Buffer.from(odbObj.toString()));
			console.log('uncompressed', Buffer.byteLength(dataBuf), 'compressed : ', Buffer.byteLength(compressedDataBuf));

			bodyBuf = Buffer.concat([bodyBuf, headerObjBuf, compressedDataBuf], bodyBuf.length + headerObjBuf.length + compressedDataBuf.length);
		}

		const shasum = crypto.createHash('sha1');
		shasum.update(Buffer.concat([headerBuf, bodyBuf], headerBuf.length + bodyBuf.length));
		const tailBuf = shasum.digest();

		const packfileBuf = Buffer.concat([headerBuf, bodyBuf, tailBuf], headerBuf.length + bodyBuf.length + tailBuf.length);

		console.log(packfileBuf.toString('hex').split('').map(hexChar => parseInt(hexChar, 16).toString(2)).join(''));

		await utils.writeFile('./test.pack', packfileBuf);

		pkline('pack', bops.from(packfileBuf));
		////

		// const oid = NodeGit.Oid.fromString(reference);
		// const packBuilder = await NodeGit.Packbuilder.create(gitRepository);
		// await packBuilder.insertCommit(oid);
		//
		// await fsextra.emptyDir(packDirPath);
		// await packBuilder.write(packDirPath, 0, () => undefined, () => undefined);
		// // console.log('to string ?', packBuilder.toString());
		//
		// const packFiles = fs.readdirSync(packDirPath);
		// const packFile = packFiles.find(fileName => fileName.endsWith('.pack'));
		// pkline('pack', bops.from(fs.readFileSync(Path.join(packDirPath, packFile))));
	}
	pkline('line', null);
}

async function sendUploadPack(stream, gitRepository) {
	const references = await gitRepository.getReferences();
	let headRef;
	for(const ref of references) {
		if (ref.isHead()) {
			headRef = ref;
		}
	}

	const pkline = pktLine.framer(function (chunk) {
		stream.write(chunk.toString());
	});

	pkline('line', `${headRef.target().tostrS()} HEAD\0multi_ack thin-pack side-band side-band-64k ofs-delta shallow no-progress include-tag multi_ack_detailed symref=HEAD:${headRef.name()} agent=git/2:2.1.1+github-607-gfba4028\n`);
	for(const refindex in references) {
		let line = `${references[refindex].target().tostrS()} ${references[refindex].name()}`;
		// TODO understand what is exactly a "peeled" ref
		// if (parseInt(refindex) === references.length -1) {
		// 	line = `${line}^{}`;
		// }
		line = `${line}\n`;
		pkline('line', line);
	}
	pkline('line', null);
}

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
		client.on('authentication', function(ctx) {
			log('client start authentication');
			const user = Buffer.from(ctx.username);
			log(`user : ${ctx.username}`);
			if (user.length !== sshUser.length
				|| !crypto.timingSafeEqual(user, sshUser)) {
				return ctx.reject();
			}
			log(`method : ${ctx.method}`);
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
						await sendUploadPack(stream, gitRepository);
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
									await sendRefPack(stream, gitRepository, wantedRefs);
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
