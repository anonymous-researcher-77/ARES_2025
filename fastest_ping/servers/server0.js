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

const PORT = 3000

const app = express();
app.use(express.json());

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

function decryptRSA(encryptedKey) {
    const buffer = Buffer.from(encryptedKey, 'base64'); // Ensure base64 decoding
    return crypto.privateDecrypt(serverPrivateKey, buffer);
}

function decryptAES (encryptedData, key) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.alloc(16, 0)); 
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8'); 
    decrypted += decipher. final('utf8');
    return decrypted;
}

// Encrypt data using AES key
function encryptAES (data, key) {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0)); // 16 bytes IV (initialization vector) 
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    encrypted += cipher. final ('base64');
    return encrypted;
}

// Function to re-encrypt AES key with the next server's public RSA key 
function encryptAESKeyForNextServer (aeskey, nextServerPublicKeyPath) {
    const nextServerPublicKey = fs.readFileSync(nextServerPublicKeyPath, 'utf8');
    return crypto.publicEncrypt(nextServerPublicKey, aeskey).toString('base64');
}

// Substrate contract call
async function callSubstrateContract (functionName, userSURI, args, gasFee) {
    const provider = new WsProvider('ws://127.0.0.1:9944');
    const api = await ApiPromise.create({ provider });
    const contractMetadata = require('/home/saeed/Desktop/Project/substrate-contracts-node/target/ink/substrate_sc/substrate_sc.json'); 
    const contractAddress = '5DU72DFyoE9feKuVzpvJ5vPbcWHgEKE7XVbLsCuagfuMkHNu';
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

function getRandomPort (excludePort) {
    const min = 3000;
    const max = 3009;
    let port;
    
    do {
        port = Math.floor(Math.random() * (max - min+1)) + min;
    } while (port === excludePort);
    
    return port;
}

function getRandomBinary() {
    return Math.floor(Math.random() * 2);
}

// app.post('/invoke-smart-contract', async (req, res) => {
//     try {
//         const { encryptedAESKeyBase64, encryptedPayloadBase64, path = [], forwardings = 0 } = req.body;

//         // Validate the incoming request
//         if (!encryptedAESKeyBase64 || !encryptedPayloadBase64) {
//             console.error('Missing encrypted data fields in request body');
//             return res.status(400).send({ message: 'Invalid request: Missing encrypted data fields.' });
//         }

//         // Add the current server to the path
//         const updatedPath = [...path, PORT];
//         console.log(`Path so far: ${updatedPath.join(' -> ')}`);

//         // Step 1: Decrypt AES key using server's private key
//         const aesKey = decryptRSA(encryptedAESKeyBase64);

//         // Step 2: Decrypt payload using AES key
//         const payload = JSON.parse(decryptAES(encryptedPayloadBase64, aesKey));
//         const { functionName, userSURI, args, network } = payload;

//         // Forwarding Logic: Check if we should forward or process locally
//         const maxForwardings = 5;  // Set a limit on the number of times a request can be forwarded
//         const unvisitedServers = Array.from({ length: 10 }, (_, i) => 3000 + i).filter(
//             (port) => !updatedPath.includes(port)
//         );

//         console.log(`Unvisited servers: ${unvisitedServers.join(', ')}`);

//         // Randomly decide whether to forward or process locally based on the number of forwardings
//         const shouldForward = Math.random() < 0.5 && forwardings < maxForwardings; // 50% chance to forward

//         if (shouldForward && unvisitedServers.length > 0) {
//             // Randomly select a server from unvisited servers
//             const randomServerPort = unvisitedServers[Math.floor(Math.random() * unvisitedServers.length)];

//             console.log(`Selected server: ${randomServerPort}`);

//             const nextServerPublicKeyPath = `../../keys/server-${randomServerPort % 10}-public-key.pem`;
//             const reEncryptedAESKey = encryptAESKeyForNextServer(aesKey, nextServerPublicKeyPath);

//             const startForwardingTime = Date.now(); // Log time before forwarding

//             try {
//                 const forwardResponse = await axios.post(
//                     `https://localhost:${randomServerPort}/invoke-smart-contract`,
//                     {
//                         encryptedAESKeyBase64: reEncryptedAESKey,
//                         encryptedPayloadBase64,  // Send as base64
//                         path: updatedPath,
//                         forwardings: forwardings + 1, // Increase forwardings count
//                     },
//                     {
//                         httpsAgent: new https.Agent({ rejectUnauthorized: false }),
//                     }
//                 );

//                 const endForwardingTime = Date.now(); // Log time after forwarding
//                 const forwardingTime = endForwardingTime - startForwardingTime; // Calculate forwarding time

//                 return res.send({
//                     ...forwardResponse.data,
//                     forwardingTime, // Include forwarding time in the response
//                 });
//             } catch (error) {
//                 console.error(`Forwarding to server ${randomServerPort} failed.`);
//                 return res.status(500).send({ message: 'Forwarding failed.' });
//             }
//         } else {
//             // If no unvisited servers or the decision was made not to forward, process the request locally
//             console.log(`Final server reached: Invoking smart contract locally on server ${PORT}`);
//             let result;
//             let invocationTime = 0;

//             const startInvocationTime = Date.now();
//             if (network === 'fabric') {
//                 result = await invokeFabricChaincode(functionName, args, userSURI);
//             } else if (network === 'substrate') {
//                 result = await callSubstrateContract(functionName, userSURI, args);
//             } else {
//                 return res.status(400).send({ message: 'Invalid network specified.' });
//             }
//             invocationTime = Date.now() - startInvocationTime;

//             return res.send({
//                 message: `${network === 'fabric' ? 'Fabric' : 'Substrate'} smart contract invoked.`,
//                 path: updatedPath,
//                 forwardings,
//                 result,
//                 invocationTime,
//                 forwardingTime: 0, // If no forwarding occurred, set forwarding time to 0
//             });
//         }
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// });

app.post('/invoke-smart-contract', async (req, res) => {
    try {
        const { encryptedAESKeyBase64, encryptedPayloadBase64, path = [], forwardings = 0 } = req.body;

        // Validate the incoming request
        if (!encryptedAESKeyBase64 || !encryptedPayloadBase64) {
            console.error('Missing encrypted data fields in request body');
            return res.status(400).send({ message: 'Invalid request: Missing encrypted data fields.' });
        }

        // Add the current server to the path
        const updatedPath = [...path, PORT];
        console.log(`Path so far: ${updatedPath.join(' -> ')}`);

        // Step 1: Decrypt AES key using server's private key
        const aesKey = decryptRSA(encryptedAESKeyBase64);

        // Step 2: Decrypt payload using AES key
        const payload = JSON.parse(decryptAES(encryptedPayloadBase64, aesKey));
        const { functionName, userSURI, args, network } = payload;

        // Forwarding Logic: Check if we should forward or process locally
        const unvisitedServers = Array.from({ length: 10 }, (_, i) => 3000 + i).filter(
            (port) => !updatedPath.includes(port)
        );

        // Enforce a minimum number of forwardings
        const shouldForward =
            (unvisitedServers.length > 0 && forwardings < 5) || // Ensure at least 5 forwardings
            (unvisitedServers.length > 0 && Math.random() > 0.5); // Random chance to forward beyond 5

        if (shouldForward) {
            console.log(`Unvisited servers: ${unvisitedServers.join(', ')}`);

            // Randomly select a server from unvisited servers
            const randomServerPort = unvisitedServers[Math.floor(Math.random() * unvisitedServers.length)];
            console.log(`Forwarding to server: ${randomServerPort}`);

            const nextServerPublicKeyPath = `../../keys/server-${randomServerPort % 10}-public-key.pem`;
            const reEncryptedAESKey = encryptAESKeyForNextServer(aesKey, nextServerPublicKeyPath);

            const startForwardingTime = Date.now(); // Log time before forwarding

            try {
                const forwardResponse = await axios.post(
                    `https://localhost:${randomServerPort}/invoke-smart-contract`,
                    {
                        encryptedAESKeyBase64: reEncryptedAESKey,
                        encryptedPayloadBase64,
                        path: updatedPath,
                        forwardings: forwardings + 1,
                    },
                    {
                        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                    }
                );

                const endForwardingTime = Date.now(); // Log time after forwarding
                const forwardingTime = endForwardingTime - startForwardingTime; // Calculate forwarding time

                return res.send({
                    ...forwardResponse.data,
                    forwardingTime, // Include forwarding time in the response
                });
            } catch (error) {
                console.error(`Forwarding to server ${randomServerPort} failed.`);
                return res.status(500).send({ message: 'Forwarding failed.' });
            }
        }

        // If there are no unvisited servers or forwarding is not required, process the request locally
        console.log(`Final server reached: Invoking smart contract locally on server ${PORT}`);
        let result;
        let invocationTime = 0;

        const startInvocationTime = Date.now();
        if (network === 'fabric') {
            result = await invokeFabricChaincode(functionName, args, userSURI);
        } else if (network === 'substrate') {
            result = await callSubstrateContract(functionName, userSURI, args);
        } else {
            return res.status(400).send({ message: 'Invalid network specified.' });
        }
        invocationTime = Date.now() - startInvocationTime;

        return res.send({
            message: `${network === 'fabric' ? 'Fabric' : 'Substrate'} smart contract invoked.`,
            path: updatedPath,
            forwardings,
            result,
            invocationTime,
            forwardingTime: 0, // If no forwarding occurred, set forwarding time to 0
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

https.createServer(options, app).listen(PORT, () => {
    console.log(`Server is listening on port ${PORT} with SSL`);
});