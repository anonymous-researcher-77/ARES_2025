const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const https = require('https');

// Load the public RSA keys of all servers for encryption
const serverPublicKeys = [
    fs.readFileSync('../../keys/server-0-public-key.pem', 'utf8'),
    fs.readFileSync('../../keys/server-1-public-key.pem', 'utf8'),
    fs.readFileSync('../../keys/server-2-public-key.pem', 'utf8'),
    fs.readFileSync('../../keys/server-3-public-key.pem', 'utf8'),
    fs.readFileSync('../../keys/server-4-public-key.pem', 'utf8'),
    fs.readFileSync('../../keys/server-5-public-key.pem', 'utf8'),
    fs.readFileSync('../../keys/server-6-public-key.pem', 'utf8'),
    fs.readFileSync('../../keys/server-7-public-key.pem', 'utf8'),
    fs.readFileSync('../../keys/server-8-public-key.pem', 'utf8'),
    fs.readFileSync('../../keys/server-9-public-key.pem', 'utf8'),
];

// Generate a new AES key
function generateAESKey() {
    return crypto.randomBytes(32); // AES-256 key (32 bytes)
}

// Encrypt AES key with RSA (server's public key)
function encryptRSA (key, publicKey) {
    const buffer = Buffer.from (key);
    return crypto.publicEncrypt (publicKey, buffer);
}

// Encrypt data using AES key
function encryptAES (data, key) {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0)); // 16 bytes IV (initialization vector) 
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    encrypted += cipher. final ('base64');
    return encrypted;
}

// Initialize CSV File
const csvFilePath = 'request_logs.csv';
if (!fs.existsSync(csvFilePath)) {
    fs.writeFileSync(csvFilePath, 'Request ID,Network,Number of Forwardings,Total Forwarding Time (ms), Throughput\n');
}

// Function to log data to the CSV file
function logToCSV(requestId, network, forwardings, forwardingTime, throughput) {
    const row = `${requestId},${network},${forwardings},${forwardingTime},${throughput}\n`;
    fs.appendFileSync(csvFilePath, row);
}

// Function to send a request to the server
async function sendRequest(requestId, serverPort, selectedPublicKey, functionName, userSURI, args, gasFee, network) {
    try {
        const aeskey = generateAESKey();
        const encryptedAESKey = encryptRSA(aeskey, selectedPublicKey);
        const payload = { functionName, userSURI, args, gasFee, network, path: [] };
        const encryptedPayload = encryptAES(payload, aeskey);
        const encryptedAESKeyBase64 = encryptedAESKey.toString('base64');

        const serverAddress = `https://localhost:${serverPort}/invoke-smart-contract`;

        const response = await axios.post(serverAddress, {
            encryptedAESKeyBase64,
            encryptedPayloadBase64: encryptedPayload
        }, {
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });

        const { path, forwardingTime, throughput } = response.data;
        const forwardings = path.length - 1; 

        console.log(`Request ID ${requestId} - Response from server ${serverPort}:`, response.data);

        // Log forwarding time & throughput to CSV
        logToCSV(requestId, network, forwardings, forwardingTime, throughput);
    } catch (error) {
        console.error(`Error from server ${serverPort}:`, error.message);
    }
}

// Function to choose a random network
function chooseRandomNetwork() {
    return Math.random() > 0.5 ? 'fabric' : 'substrate';
}

// Send requests to random servers
async function sendRandomRequests() {
    for (let i = 0; i < 100; i++) {
        const requestId = i + 1;
        const serverIndex = Math.floor(Math.random() * serverPublicKeys.length);
        const selectedPublicKey = serverPublicKeys[serverIndex];
        const network = 'fabric';
        const functionName = 'add';
        let userSURI = null;
        let args;

        if (network === 'fabric') {
            args = ['10', '20'];
            userSURI = 'SampleUser';
        } else if (network === 'substrate') {
            args = [10, 20];
            userSURI = '//Alice';
        }

        // Send the request to the randomly chosen server
        await sendRequest(requestId, 3000 + serverIndex, selectedPublicKey, functionName, userSURI, args, 0, network);
    }
}

sendRandomRequests();
