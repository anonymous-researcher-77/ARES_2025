const express = require('express');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { ContractPromise } = require('@polkadot/api-contract');
const BN = require('bn.js');
const path = require('path');
const { Gateway, Wallets } = require('fabric-network');

const app = express();
app.use(express.json());

// Use environment variables for configuration
const port = 3009;
const serverIndex = process.env.SERVER_INDEX || 1; // The unique index for this server

// Load SSL/TLS certificates for HTTPS using environment-based paths
const options = {
    key: fs.readFileSync(`../../certs/server-9-key.pem`),
    cert: fs.readFileSync(`../../certs/server-9-cert.pem`),
    ca: [fs.readFileSync('../../certs/ca-cert.pem')],
    requestCert: true,
    rejectUnauthorized: false, // Allow self-signed certs for testing
};

const maxHops = 10;

// Load the server's private key based on the index
const serverPrivateKey = fs.readFileSync(`../../keys/server-9-private-key.pem`, 'utf8');

// Load all servers' public keys (assuming keys are named server-0-public-key.pem, etc.)
const serverPublicKeys = [];
for (let i = 0; i < 10; i++) {
    serverPublicKeys.push(fs.readFileSync(`../../keys/server-${i}-public-key.pem`, 'utf8'));
}

// Utility functions remain unchanged
function decryptRSA(encryptedKey) {
    const buffer = Buffer.from(encryptedKey, 'base64');
    return crypto.privateDecrypt(serverPrivateKey, buffer);
}

function decryptAES(encryptedData, key) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.alloc(16, 0));
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function encryptAES(data, key) {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0));
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

function encryptRSA(data, publicKey) {
    const buffer = Buffer.from(data);
    return crypto.publicEncrypt(
        { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
        buffer
    );
}

// ----- Smart Contract Invocation (Fabric & Substrate) -----
async function callSubstrateContract(functionName, userSURI, args) {
    const provider = new WsProvider('ws://127.0.0.1:9944');
    const api = await ApiPromise.create({ provider });
    const contractMetadata = require('/home/saeed/Desktop/Project/substrate-contracts-node/target/ink/substrate_sc/substrate_sc.json');
    const contractAddress = '5EMummcdVGnwoV2ETH3dexrUJyQGGvoHpj12AsbtFnLatDK3';
    const contract = new ContractPromise(api, contractMetadata, contractAddress);
    const keyring = new Keyring({ type: 'sr25519' });
    const user = keyring.addFromUri(userSURI);
    const gasLimit = api.registry.createType('WeightV2', {
        refTime: new BN('1000000000000'),
        proofSize: new BN('100000000000'),
    });
    const result = await contract.query[functionName](user.address, { gasLimit }, ...args);
    if (result.result.isErr) {
        throw new Error(`Smart contract call failed: ${result.result.asErr.toString()}`);
    }
    return result.output.toJSON();
}

async function invokeFabricChaincode(functionName, args, userSURI) {
    try {
        const ccpPath = '/home/saeed/Desktop/Project/substrate-contracts-node/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json';
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const walletPath = path.join(process.cwd(), '../../enroll_admin/wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        const identity = await wallet.get(userSURI);
        if (!identity) {
            console.log(`An identity for the user "${userSURI}" does not exist in the wallet`);
            return null;
        }
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: userSURI, discovery: { enabled: true, asLocalhost: true } });
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('fabric_cc');
        const result = await contract.submitTransaction(functionName, ...args);
        console.log(`Transaction has been submitted, result is: ${result.toString()}`);
        await gateway.disconnect();
        return result.toString();
    } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
        throw error;
    }
}

// ----- Throughput Metrics -----
// These globals track the number of transactions processed and the cumulative processing time (in ms)
// ----- Global Metrics -----
let transactionCount = 0;
let totalProcessingTime = 0;
// New: Array to capture each request's processing time (in ms)
let processingTimes = [];

// ----- Middleware: Timing for all requests -----
app.use((req, res, next) => {
    const startTime = process.hrtime.bigint();
    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const processingTimeMs = Number(endTime - startTime) / 1e6;
        totalProcessingTime += processingTimeMs;
        transactionCount++;
        processingTimes.push(processingTimeMs);
        console.log(`Request processed in ${processingTimeMs.toFixed(3)} ms`);
    });
    next();
});

// ----- /resource-load Endpoint -----
app.get('/resource-load', (req, res) => {
    res.json({ load: transactionCount });
});

// ----- Forwarding Decision Logic -----
// (Existing logic remains unchanged)
async function selectNextServer(currentPort) {
    const servers = [];
    for (let i = 3000; i <= 3009; i++) {
        if (i !== currentPort) {
            try {
                const response = await axios.get(`https://localhost:${i}/resource-load`, {
                    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                });
                const load = response.data.load;
                servers.push({ port: i, load });
            } catch (error) {
                console.error(`Error fetching load from server ${i}:`, error.message);
            }
        }
    }
    if (servers.length === 0) {
        console.error('No servers responded. Defaulting to current server.');
        return currentPort;
    }
    const nextServer = servers.reduce((prev, curr) => (prev.load < curr.load ? prev : curr));
    return nextServer.port;
}

// ----- /invoke-smart-contract Endpoint -----
// (Existing logic remains unchanged)
app.post('/invoke-smart-contract', async (req, res) => {
    const globalStartTime = process.hrtime.bigint(); // Start timer for the whole request handling
    try {
        const { encryptedAESKeyBase64, encryptedPayloadBase64, path: requestPath = [], hops = 0 } = req.body;
        if (!encryptedAESKeyBase64 || !encryptedPayloadBase64) {
            return res.status(400).send({ message: 'Invalid request: Missing encrypted data fields.' });
        }

        const aesKey = decryptRSA(encryptedAESKeyBase64);
        const payloadJSON = decryptAES(encryptedPayloadBase64, aesKey);
        const payload = JSON.parse(payloadJSON);
        const { functionName, userSURI, args, network } = payload;
        const updatedPath = [...requestPath, port];

        if (hops >= maxHops) {
            return invokeLocally(network, functionName, userSURI, args, updatedPath, res, globalStartTime);
        }

        const forwardDecision = Math.random() > 0.5;
        if (forwardDecision) {
            const nextServerPort = await selectNextServer(port);
            const reEncryptedAESKey = encryptRSA(aesKey, serverPublicKeys[nextServerPort - 3000]);
            const forwardingStartTime = process.hrtime.bigint();
            const forwardedResponse = await axios.post(`https://localhost:${nextServerPort}/invoke-smart-contract`, {
                encryptedAESKeyBase64: reEncryptedAESKey.toString('base64'),
                encryptedPayloadBase64,
                path: updatedPath,
                hops: hops + 1,
            }, {
                httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            });
            const forwardingEndTime = process.hrtime.bigint();
            const forwardingTimeMs = Number(forwardingEndTime - forwardingStartTime) / 1e6;
            const totalTimeMs = Number(process.hrtime.bigint() - globalStartTime) / 1e6;

            return res.send({
                message: `Request forwarded to server ${nextServerPort}`,
                path: forwardedResponse.data.path,
                result: forwardedResponse.data.result,
                forwardingTime: forwardingTimeMs,
                transactionTime: totalTimeMs,
            });
        } else {
            return invokeLocally(network, functionName, userSURI, args, updatedPath, res, globalStartTime);
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// ----- Local Invocation Logic -----
async function invokeLocally(network, functionName, userSURI, args, updatedPath, res, globalStartTime) {
    try {
        const invocationStartTime = process.hrtime.bigint();
        let result;
        if (network === 'fabric') {
            result = await invokeFabricChaincode(functionName, args, userSURI);
        } else if (network === 'substrate') {
            result = await callSubstrateContract(functionName, userSURI, args);
        } else {
            return res.status(400).send({ message: 'Invalid network specified.' });
        }
        const invocationEndTime = process.hrtime.bigint();
        const invocationTimeMs = Number(invocationEndTime - invocationStartTime) / 1e6;
        const totalTimeMs = Number(process.hrtime.bigint() - globalStartTime) / 1e6;
        const forwardingTimeMs = totalTimeMs - invocationTimeMs;
        return res.send({
            message: `${network} contract invoked locally.`,
            path: updatedPath,
            result,
            invocationTime: invocationTimeMs,
            forwardingTime: forwardingTimeMs,
            transactionTime: totalTimeMs,
        });
    } catch (error) {
        console.error('Error during local invocation:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

// ----- /throughput Endpoint -----
app.get('/throughput', (req, res) => {
    const throughputPerSecond = transactionCount > 0 ? (transactionCount * 1000) / totalProcessingTime : 0;
    res.json({
        port,
        transactions: transactionCount,
        totalProcessingTime: totalProcessingTime.toFixed(3),
        throughputPerSecond: throughputPerSecond.toFixed(3),
    });
});

// ----- New: /latency Endpoint -----
// Provides detailed latency statistics based on recorded processing times.
app.get('/latency', (req, res) => {
    if (processingTimes.length === 0) {
        return res.json({ message: 'No latency data available yet.' });
    }
    // Calculate average latency
    const sum = processingTimes.reduce((acc, time) => acc + time, 0);
    const averageLatency = sum / processingTimes.length;

    // Sort times to calculate median and percentiles
    const sortedTimes = [...processingTimes].sort((a, b) => a - b);
    const medianLatency = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const p95Latency = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || sortedTimes[sortedTimes.length - 1];
    const p99Latency = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || sortedTimes[sortedTimes.length - 1];

    res.json({
        count: processingTimes.length,
        averageLatency: averageLatency.toFixed(3),
        medianLatency: medianLatency.toFixed(3),
        p95Latency: p95Latency.toFixed(3),
        p99Latency: p99Latency.toFixed(3)
    });
});

// ----- Create HTTPS Server -----
https.createServer(options, app).listen(port, () => {
    console.log(`Server running securely on https://localhost:${port} (SERVER_INDEX=${serverIndex})`);
});