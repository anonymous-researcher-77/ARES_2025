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

const port = 3005

const app = express();
app.use(express.json());
// app.use(bodyParser.json());

// Load SSL/TLS certificates for server-side SSL
const options = {
    key: fs.readFileSync('../../certs/server-5-key.pem'), // Server private key
    cert: fs.readFileSync('../../certs/server-5-cert.pem'), // Server certificate
    ca: [ // Load CA certificates for client verification if needed
        fs.readFileSync('../../certs/ca-cert.pem')
    ],
    requestCert: true, // Request client certificate; can be toggled based on security needs
    rejectUnauthorized: false // Allow self-signed certificates (set to `true` for production)
};

// Load server-specific keys
const serverPrivateKey = fs.readFileSync('../../keys/server-5-private-key.pem', 'utf8'); // Replace X with the server index

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
    const contractAddress = '5FKyK5DzxCoqDoeEckhweoPLDZLs8E5vrGwG1tUMbKsTFLrE';
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

// Enhanced decision logic for transitioning to the fluff phase
function shouldSwitchToFluff(path = [], maxStemLength = 5) {
    // Ensure path is an array if undefined
    if (!Array.isArray(path)) {
        path = []; // Default to empty array if path is not an array
    }

    // Transition to fluff based on:
    // 1. A maximum number of hops (stem phase max length)
    // 2. A 50% chance once the maximum hops are reached (if stem phase is long enough)
    if (path.length >= maxStemLength) {
        return true; // Always switch to fluff once max hops are reached
    }

    // 50% chance to move to the fluff phase if not yet at max hops
    return Math.random() > 0.5;
}


// Function to forward the request to the next server
function getRandomPort(excludePort) {
    const min = 3000;
    const max = 3009;
    let port;
    
    do {
        port = Math.floor(Math.random() * (max - min + 1)) + min;
    } while (port === excludePort);
    
    return port;
}

// Stem/Fluff logic
app.post('/invoke-smart-contract', async (req, res) => {
    try {
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
            // Randomly decide whether to move to the fluff phase
            if (shouldSwitchToFluff()) {
                return invokeLocally(network, functionName, userSURI, args, updatedPath, res);
            } else {
                const nextServerPort = getRandomPort(port);
                const nextServerPublicKeyPath = `../../keys/server-${nextServerPort % 10}-public-key.pem`;
                const reEncryptedAESKey = encryptAESKeyForNextServer(aeskey, nextServerPublicKeyPath);

                // Forward the request to another server in stem phase
                const forwardedResponse = await axios.post(`https://localhost:${nextServerPort}/invoke-smart-contract`, {
                    encryptedAESKeyBase64: reEncryptedAESKey,
                    encryptedPayloadBase64,
                    path: updatedPath,
                    phase: 'stem' // Continue forwarding in stem phase
                }, {
                    httpsAgent: new https.Agent({ rejectUnauthorized: false })
                });

                return res.send({
                    message: `Request forwarded to server ${nextServerPort}`,
                    path: forwardedResponse.data.path,
                    result: forwardedResponse.data.result
                });
            }
        } else {
            return invokeLocally(network, functionName, userSURI, args, updatedPath, res);
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Local invocation after stem phase ends
async function invokeLocally(network, functionName, userSURI, args, path, res) {
    let result;
    if (network === 'fabric') {
        result = await invokeFabricChaincode(functionName, args, userSURI);
    } else if (network === 'substrate') {
        result = await callSubstrateContract(functionName, userSURI, args);
    } else {
        return res.status(400).send({ message: 'Invalid network specified.' });
    }

    return res.send({
        message: `${network} contract invoked.`,
        path, 
        result
    });
}

// Start the server with HTTPS
https.createServer(options, app).listen(port, () => {
    console.log(`Server running on https://localhost:${port}`);
});


// const STAGES = {
//     STEM: 'stem',
//     FLUFF: 'fluff'
// };

// let visitedServers = new Set();  // To track visited servers
// let currentStage = STAGES.STEM;  // Start in the stem phase

// app.post('/invoke-smart-contract', async (req, res) => {
//     try {
//         const { encryptedAESKeyBase64, encryptedPayloadBase64, path = [] } = req.body;

//         if (!encryptedAESKeyBase64 || !encryptedPayloadBase64) {
//             console.error('Missing encrypted data fields in request body');
//             return res.status(400).send({ message: 'Invalid request: Missing encrypted data fields.' });
//         }

//         // Add the current server to the path
//         const updatedPath = [...path, port];  // Use `port` instead of `PORT` for dynamic server port
//         console.log(`Path so far: ${updatedPath.join(' -> ')}`);

//         // Step 1: Decrypt AES key using server's private key
//         const aeskey = decryptRSA(encryptedAESKeyBase64);

//         // Step 2: Decrypt payload using AES key
//         const payload = JSON.parse(decryptAES(encryptedPayloadBase64, aeskey)); 
//         const { functionName, userSURI, args, network } = payload;

//         // Update the current stage before selecting the next server
//         currentStage = getNextStage(); // Transition stage from stem to fluff or vice versa

//         // Select the next server based on Dandelion++'s stem/fluff logic
//         const nextServerPort = selectNextServer(currentStage);
//         if (!nextServerPort) {
//             console.log('No more servers to forward to. Invoking smart contract locally.');
//             // If no servers are left to forward to, invoke the smart contract locally
//             let result;
//             if (network === 'fabric') {
//                 result = await invokeFabricChaincode(functionName, args, userSURI);
//             } else if (network === 'substrate') {
//                 result = await callSubstrateContract(functionName, userSURI, args);
//             }

//             return res.send({
//                 message: `Smart contract invoked locally.`,
//                 path: updatedPath, 
//                 result,
//                 forwardings: updatedPath.length - 1  // Path length (number of forwardings)
//             });
//         }

//         console.log(`Forwarding request from server ${port} to server ${nextServerPort}`);
        
//         const nextServerPublicKeyPath = `../../keys/server-${nextServerPort % 10}-public-key.pem`; 
//         const reEncryptedAESKey = encryptAESKeyForNextServer(aeskey, nextServerPublicKeyPath);

//         // Forward the request and wait for the response
//         const forwardedResponse = await axios.post(`https://localhost:${nextServerPort}/invoke-smart-contract`, {
//             encryptedAESKeyBase64: reEncryptedAESKey,
//             encryptedPayloadBase64,
//             path: updatedPath // Pass along the updated path
//         }, {
//             httpsAgent: new https.Agent({ rejectUnauthorized: false })
//         });

//         // Return the result along with the full path after forwarding
//         return res.send({
//             message: `Request forwarded to server ${nextServerPort}`,
//             path: forwardedResponse.data.path, // Use the full path returned by the last server
//             result: forwardedResponse.data.result, // Send back the result from the forwarded request
//             forwardings: forwardedResponse.data.forwardings + 1  // Add to the forwarded count (incremented on each hop)
//         });
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// });

// // Function to select the next server based on Dandelion++'s stem or fluff logic
// function selectNextServer(currentStage) {
//     const availableServers = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009]
//         .filter(port => !visitedServers.has(port) && port !== port);

//     if (availableServers.length === 0) {
//         return null; // No more servers available for forwarding
//     }

//     if (currentStage === STAGES.STEM) {
//         // In the stem phase, we forward deterministically (in an ordered manner)
//         return availableServers[0];  // Pick the next unvisited server
//     }

//     // In the fluff phase, we forward randomly
//     if (currentStage === STAGES.FLUFF) {
//         return availableServers[Math.floor(Math.random() * availableServers.length)];
//     }

//     return availableServers[0]; // Default to the first available server if no stage is specified
// }

// // Function to get the next stage (stem or fluff) based on some criteria
// function getNextStage() {
//     const transitionToFluffAfterHops = 5;  // Switch to fluff after 5 hops
//     const isStemPhase = currentStage !== STAGES.FLUFF;
    
//     if (isStemPhase && visitedServers.size >= transitionToFluffAfterHops) {
//         currentStage = STAGES.FLUFF; // Transition to fluff phase
//     }

//     return currentStage;
// }