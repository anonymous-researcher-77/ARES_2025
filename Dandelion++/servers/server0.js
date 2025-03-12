const express = require('express');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { ContractPromise } = require('@polkadot/api-contract');
const BN = require('bn.js');
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');

const redis = require('redis');
const client = redis.createClient();
client.connect();

const port = 3000

const app = express();
app.use(express.json());
// app.use(bodyParser.json());

// Load SSL/TLS certificates for server-side SSL
const options = {
    key: fs.readFileSync('../../certs/server-0-key.pem'), // Server private key
    cert: fs.readFileSync('../../certs/server-0-cert.pem'), // Server certificate
    ca: [ // Load CA certificates for client verification if needed
        fs.readFileSync('../../certs/ca-cert.pem')
    ],
    requestCert: true, // Request client certificate; can be toggled based on security needs
    rejectUnauthorized: false // Allow self-signed certificates (set to `true` for production)
};

// Load server-specific keys
const serverPrivateKey = fs.readFileSync('../../keys/server-0-private-key.pem', 'utf8'); // Replace X with the server index

let requestCount = 0;
const throughputInterval = 1000; // Interval to measure throughput in milliseconds
let currentThroughput = 0;

// Update throughput every second
setInterval(async () => {
    const count = await client.get('requestCount') || 0;
    await client.set('currentThroughput', count);
    await client.set('requestCount', 0); // Reset count for next interval
}, 1000);


// Function to decrypt the AES key using RSA private key
function decryptRSA(encryptedKey) {
    const buffer = Buffer.from(encryptedKey, 'base64'); // Ensure base64 decoding
    return crypto.privateDecrypt(serverPrivateKey, buffer);
}

// Function to decrypt the payload using the AES key
function decryptAES(encryptedData, key) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.alloc(16, 0)); 
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8'); 
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Function to encrypt data using AES key
function encryptAES(data, key) {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0)); // 16 bytes IV (initialization vector) 
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

// Function to re-encrypt AES key with the next server's public RSA key
function encryptAESKeyForNextServer(aeskey, nextServerPublicKeyPath) {
    const nextServerPublicKey = fs.readFileSync(nextServerPublicKeyPath, 'utf8');
    return crypto.publicEncrypt(nextServerPublicKey, aeskey).toString('base64');
}

// Dandelion++ Phase Decision
function isInStemPhase(path) {
    // Define the maximum stem length (number of hops before transition to fluff)
    const maxStemLength = 5;
    return path.length < maxStemLength;
}

// Substrate contract call
async function callSubstrateContract (functionName, userSURI, args, gasFee) {
    const provider = new WsProvider('ws://127.0.0.1:9944');
    const api = await ApiPromise.create({ provider });
    const contractMetadata = require('/home/saeed/Desktop/Project/substrate-contracts-node/target/ink/substrate_sc/substrate_sc.json'); 
    const contractAddress = '5EitsmhuETxuVVRTdHU9MXnPWYmE9HdEJ7ngJ6gbHxK1aT2o';
    const contract = new ContractPromise (api, contractMetadata, contractAddress);
    const keyring = new Keyring({ type: 'sr25519' });
    const user = keyring.addFromUri(userSURI);
    const gasLimit = api. registry.createType('WeightV2', {
        refTime: new BN ('1000000000000'),
        proofSize: new BN ('100000000000')
    });
        const result = await contract.query[functionName](
            user.address,
            { gasLimit },
            ...args
        );
    if (result.result.isErr) {
            throw new Error(`Smart contract call failed: ${result.result.asErr.toString()}`);
    }
    const output = result.output.toJSON();
    return output;
}

async function invokeFabricChaincode (functionName, args, userSURI){ 
    try {
        const ccpPath = '/home/saeed/Desktop/Project/substrate-contracts-node/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json';
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const walletPath = path.join(process.cwd(), '../../enroll_admin/wallet');
        const wallet = await Wallets.newFileSystemWallet (walletPath);
        const identity = await wallet.get(userSURI);
        if (!identity) {
            console.log(`An identity for the user "${userSURI}" does not exist in the wallet`); 
            return null;
        }
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: userSURI, discovery: { enabled: true, asLocalhost: true } }); 
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('fabric_cc');
        const result = await contract.submitTransaction (functionName, ...args);
        console.log(`Transaction has been submitted, result is: ${result.toString()}`);
        await gateway.disconnect();
        return result.toString();
    } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
        throw error;
    }
}

// ----- Global Metrics -----
// These globals track the number of transactions processed, the cumulative processing time (in ms),
// and an array of individual processing times for latency analysis.
let transactionCount = 0;
let totalProcessingTime = 0;
let processingTimes = [];

// ----- Middleware: Timing for All Requests -----
// This middleware captures a high-resolution timestamp for every request and calculates its processing time.
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

// ----- Dandelion++ Decision Logic -----
function shouldSwitchToFluff(path = [], maxStemLength = 5) {
    if (!Array.isArray(path)) {
        path = [];
    }
    if (path.length >= maxStemLength) {
        return true;
    }
    return Math.random() > 0.5;
}

// Function to forward the request to the next server randomly, excluding the current server.
function getRandomPort(excludePort) {
    const min = 3000;
    const max = 3009;
    let port;
    do {
        port = Math.floor(Math.random() * (max - min + 1)) + min;
    } while (port === excludePort);
    return port;
}

// ----- /invoke-smart-contract Endpoint -----
app.post('/invoke-smart-contract', async (req, res) => {
    try {
        const startTime = Date.now(); // Used for forwarding delay calculation

        // Increment request count in Redis
        await client.incr('requestCount');

        const { encryptedAESKeyBase64, encryptedPayloadBase64, path = [], phase = 'stem' } = req.body;
        if (!encryptedAESKeyBase64 || !encryptedPayloadBase64) {
            return res.status(400).send({ message: 'Invalid request: Missing encrypted data fields.' });
        }

        // Add the current server to the path
        const updatedPath = [...path, port];

        // Decrypt AES key and payload
        const aeskey = decryptRSA(encryptedAESKeyBase64);
        const payload = JSON.parse(decryptAES(encryptedPayloadBase64, aeskey)); 
        const { functionName, userSURI, args, network } = payload;

        if (phase === 'stem') {
            if (shouldSwitchToFluff(updatedPath)) {
                return invokeLocally(network, functionName, userSURI, args, updatedPath, startTime, res);
            } else {
                const nextServerPort = getRandomPort(port);
                const nextServerPublicKeyPath = `../../keys/server-${nextServerPort % 10}-public-key.pem`;
                const reEncryptedAESKey = encryptAESKeyForNextServer(aeskey, nextServerPublicKeyPath);

                const forwardedResponse = await axios.post(`https://localhost:${nextServerPort}/invoke-smart-contract`, {
                    encryptedAESKeyBase64: reEncryptedAESKey,
                    encryptedPayloadBase64,
                    path: updatedPath,
                    phase: 'stem'
                }, {
                    httpsAgent: new https.Agent({ rejectUnauthorized: false })
                });

                const forwardingTime = Date.now() - startTime; // Compute delay

                // Get latest throughput before responding
                const currentThroughput = await client.get('currentThroughput') || 0;

                return res.send({
                    message: `Request forwarded to server ${nextServerPort}`,
                    path: forwardedResponse.data.path,
                    result: forwardedResponse.data.result,
                    forwardingTime,
                    throughput: currentThroughput
                });
            }
        } else {
            return invokeLocally(network, functionName, userSURI, args, updatedPath, startTime, res);
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ----- Local Invocation Logic -----
async function invokeLocally(network, functionName, userSURI, args, path, startTime, res) {
    let result;
    if (network === 'fabric') {
        result = await invokeFabricChaincode(functionName, args, userSURI);
    } else if (network === 'substrate') {
        result = await callSubstrateContract(functionName, userSURI, args);
    } else {
        return res.status(400).send({ message: 'Invalid network specified.' });
    }

    const forwardingTime = Date.now() - startTime; // Compute delay

    // Get latest throughput before responding
    const currentThroughput = await client.get('currentThroughput') || 0;

    return res.send({
        message: `${network} contract invoked.`,
        path, 
        result,
        forwardingTime,
        throughput: currentThroughput
    });
}

// ----- New: /latency Endpoint -----
// This endpoint returns detailed latency statistics based on the recorded processing times.
app.get('/latency', (req, res) => {
    if (processingTimes.length === 0) {
        return res.json({ message: 'No latency data available yet.' });
    }
    // Calculate average latency
    const sum = processingTimes.reduce((acc, time) => acc + time, 0);
    const averageLatency = sum / processingTimes.length;

    // Sort times to calculate median and percentile values
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

// ----- Start the HTTPS Server -----
https.createServer(options, app).listen(port, () => {
    console.log(`Server running on https://localhost:${port}`);
});