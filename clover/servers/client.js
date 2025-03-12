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
    fs.writeFileSync(csvFilePath, 'Request ID,Network,Number of Forwardings,Total Forwarding Time (ms)\n');
}

// Function to log data to the CSV file
function logToCSV(requestId, network, forwardings, forwardingTime) {
    const row = `${requestId},${network},${forwardings},${forwardingTime}\n`;
    fs.appendFileSync(csvFilePath, row);
}

// Function to send a request to the server
async function sendRequest(requestId, serverPort, selectedPublicKey, functionName, userSURI, args, gasFee, network) {
    try {
        // Generate a new AES key
        const aeskey = generateAESKey();

        // Encrypt the AES key using the selected server's public RSA key
        const encryptedAESKey = encryptRSA(aeskey, selectedPublicKey);

        // Create the payload with all the data, including initializing the path
        const payload = {
            functionName,
            userSURI,
            args,
            gasFee,
            network,
            path: [] // Initialize an empty path array
        };
        const encryptedPayload = encryptAES(payload, aeskey);

        // Convert the encrypted values to base64
        const encryptedAESKeyBase64 = encryptedAESKey.toString('base64');

        // Construct server address
        const serverAddress = `https://localhost:${serverPort}/invoke-smart-contract`;

        // Start timer for forwarding
        const startTime = Date.now();

        // Send the RSA-encrypted AES key and the AES-encrypted payload to the server
        const response = await axios.post(serverAddress, {
            encryptedAESKeyBase64,
            encryptedPayloadBase64: encryptedPayload
        }, {
            httpsAgent: new https.Agent({
                rejectUnauthorized: false // Accept self-signed certificates for testing
            })
        });

        const { path } = response.data; // Extract the path from the response
        const forwardings = path.length - 1; // Number of forwardings is path length minus 1 (initial server)

        console.log(`Request ID ${requestId} - Response from server ${serverPort}:`, response.data);

        // Log the data to CSV
        const forwardingTime = response.data.forwardingTime; // Ensure the server sends just the forwarding time
        logToCSV(requestId, network, forwardings + 1, forwardingTime);
    } catch (error) {
        if (error.response) {
            console.error(`Error from server ${serverPort}:`, error.response.status, error.response.data);
        } else {
            console.error(`Error ${serverPort}:`, error.message);
        }
    }
}

// Function to choose a random network
function chooseRandomNetwork() {
    return Math.random() > 0.5 ? 'fabric' : 'substrate';
}

// Send requests to random servers
async function sendRandomRequests() {
    for (let i = 0; i < 1000; i++) {
        const requestId = i + 1;
        const serverIndex = Math.floor(Math.random() * serverPublicKeys.length);
        const selectedPublicKey = serverPublicKeys[serverIndex];
        // const network = chooseRandomNetwork();
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

async function getThroughputData() {
    for (let i = 0; i < serverPublicKeys.length; i++) {
        const port = 3000 + i;
        try {
            const response = await axios.get(`https://localhost:${port}/throughput`, {
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                })
            });
            console.log(`Throughput data for server ${port}:`, response.data);
        } catch (error) {
            console.error(`Error fetching throughput data from server ${port}:`, error.message);
        }
    }
}

// Call getThroughputData after sending requests (with a slight delay if needed)
sendRandomRequests().then(() => {
    setTimeout(getThroughputData, 1000); // wait a second before querying throughput
});

