'use strict';

const crypto = require('crypto');

const {deflate} = require('zlib');
const util = require('util');

const bops = require('bops');
const NodeGit = require('nodegit');
const pktLine = require('git-pkt-line');

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
		buffer[i] &= ~(1 << 7 - bit);
	}else{
		buffer[i] |= (1 << 7 - bit);
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

function bufTobin(buffer) {
	return buffer.toString('hex').split('').map(hexChar => parseInt(hexChar, 16).toString(2).padStart(4, '0')).join('')
}

async function sendRefPack(stream, gitRepository, references) {
	const pkline = pktLine.framer(function (chunk) {
		stream.write(chunk);
	});
	for (const reference of references) {
		const oids = [];
		const commit = await gitRepository.getCommit(reference);
		const treeOid = commit.treeId().tostrS();
		oids.push(commit.sha(), treeOid);
		const tree = await gitRepository.getTree(treeOid);
		const trees = [tree];
		const treeEntries = await new Promise((res, rej) => {
			tree.walk(false)
				.on('end', res)
				.on('error', rej)
				.start();
		});

		await Promise.all(treeEntries.map(async treeEntry => {
			if (treeEntry.isTree()) {
				trees.push(await treeEntry.getTree());
			}
		}));
		const treesDatas = {};
		// libGit does not provide a reliable toString function to access tree data
		// So it is a home made one that works, see https://stackoverflow.com/a/37105125
		await Promise.all(trees.map(async tree => {
			let lines = Buffer.alloc(0);
			tree.entries().forEach(treeEntry => {
				let shaBin = Buffer.from(treeEntry.sha(), 'hex');
				lines = Buffer.concat([lines, Buffer.from(`${treeEntry.filemode().toString(8)} ${treeEntry.name()}\0`), shaBin]);
			});
			treesDatas[tree.id().toString()] = lines;
		}));

		const treeIds = [treeOid].concat(treeEntries.map(treeEntry => treeEntry.oid()));
		oids.push(...treeIds);
		const uniqueOids = oids.filter(function(elem, pos) {
			return oids.indexOf(elem) == pos;
		});

		const odb = await gitRepository.odb();

		// TODO throw error if there is more than 9999 references to write
		const headerBuf = Buffer.alloc(12, 0, 'binary');
		headerBuf.write('PACK');
		headerBuf.writeUInt32BE(2, 4);
		headerBuf.writeUInt32BE(uniqueOids.length, 8);

		let bodyBuf = Buffer.alloc(0);

		const oidObjects = await Promise.all(uniqueOids.map(oid => odb.read(oid)));

		// TODO improve this
		oidObjects.sort((objA, objB) => {
			if (objA.type() === NodeGit.Object.TYPE.COMMIT) {
				return -1;
			}
			if (objB.type() === NodeGit.Object.TYPE.TREE) {
				return objA.type() === NodeGit.Object.TYPE.BLOB ? -1 : 1;
			}
			if (objA.type() === objB.type()) {
				return 0;
			}
			return objA.type() > objB.type() ? 1 : -1;
		});


		for(const odbObj of oidObjects) {
			let objSize;
			if (odbObj.type() === NodeGit.Object.TYPE.TREE) {
				objSize = treesDatas[odbObj.id().toString()].length;
			} else {
				objSize = Buffer.from(odbObj.toString(), 'binary').length;
			}
			let headerBitsSize = 4;
			let lengthBitsSize = 4;
			while ((2 ** lengthBitsSize) < objSize) {
				lengthBitsSize += 7;
				headerBitsSize += 1;
			}
			const headerSize = (lengthBitsSize + headerBitsSize) / 8;
			const headerObjBuf = Buffer.alloc(headerSize, 0, 'binary');

			if (objSize >= 16) {
				setBit(headerObjBuf, 0, 0, 1);
			}

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

			let sizeBin = objSize.toString(2);
			sizeBin = sizeBin.padStart(lengthBitsSize, '0');

			setBits(headerObjBuf, 0, 4, sizeBin.substring(sizeBin.length - 4).split('').map(ch => parseInt(ch)));
			if (objSize >= 16) {
				let restOfSizeBits = sizeBin.slice(0, -4);
				let curByteIndex = 1;
				while (restOfSizeBits.length > 0) {
					if (restOfSizeBits.length === 7) { // last chunk, set the MSB to zero
						setBit(headerObjBuf, curByteIndex, 0, 0);
					} else {
						setBit(headerObjBuf, curByteIndex, 0, 1);
					}
					setBits(headerObjBuf, curByteIndex, 1, restOfSizeBits.slice(0,7).split('').map(ch => parseInt(ch)));
					curByteIndex ++;
					restOfSizeBits = restOfSizeBits.slice(7);
				}
			}

			let objData;
			if (odbObj.type() === NodeGit.Object.TYPE.TREE) {
				objData = await deflatePromise(treesDatas[odbObj.id().toString()]);
			} else {
				objData = await deflatePromise(odbObj.toString());
			}

			bodyBuf = Buffer.concat([bodyBuf, headerObjBuf, objData], bodyBuf.length + headerObjBuf.length + objData.length);
		}

		const shasum = crypto.createHash('sha1');
		shasum.update(Buffer.concat([headerBuf, bodyBuf], headerBuf.length + bodyBuf.length));
		const tailBuf = shasum.digest();
		const packfileBuf = Buffer.concat([headerBuf, bodyBuf, tailBuf], headerBuf.length + bodyBuf.length + tailBuf.length);

		pkline('pack', bops.from(packfileBuf));
	}
	pkline('line', null);
}

async function sendUploadPackRefs(stream, gitRepository) {
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

module.exports = {
	sendUploadPackRefs,
	sendRefPack
};
