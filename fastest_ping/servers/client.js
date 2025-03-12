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

// Function to log data to a CSV
function logToCSV(requestId, network, forwardings, forwardingTime) {
    const csvData = `${new Date().toISOString()}, ${requestId}, ${network}, ${forwardings}, ${forwardingTime}\n`;

    // Append the data to a CSV file
    fs.appendFile('forwarding_times.csv', csvData, (err) => {
        if (err) {
            console.error('Error writing to CSV file:', err);
        } else {
            console.log('Forwarding time logged to CSV');
        }
    });
}

// Create an https agent to bypass certificate validation
const agent = new https.Agent({  
    rejectUnauthorized: false  // Disable certificate validation
  });
  
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

        // Encrypt the payload using AES
        const encryptedPayload = encryptAES(payload, aeskey);

        // Convert encrypted values to base64
        const encryptedAESKeyBase64 = encryptedAESKey.toString('base64');
        const encryptedPayloadBase64 = encryptedPayload.toString('base64'); // Convert the encrypted payload to base64

        // Construct server address
        const serverAddress = `https://localhost:${serverPort}/invoke-smart-contract`;

        // Send the RSA-encrypted AES key and the AES-encrypted payload to the server
        const response = await axios.post(serverAddress, {
            encryptedAESKeyBase64,
            encryptedPayloadBase64, // Send the encrypted payload as base64
            path: [], // Initialize the path as empty
            forwardings: 0, // Start with no forwardings
        }, {
            httpsAgent: agent // Pass the agent to Axios
        });

        // Extract forwarding time and path from the response
        const forwardingTime = response.data.forwardingTime;
        const { path } = response.data;
        const forwardings = path.length - 1; // Calculate the number of forwardings based on the path length

        console.log(`Request ID ${requestId} - Response from server ${serverPort}:`, response.data);

        // Log the forwarding time and related data to CSV
        logToCSV(requestId, network, forwardings, forwardingTime);
        
        return response.data; // Return the response for further use if necessary
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
    for (let i = 0; i < 180; i++) {
        const requestId = i + 1;
        const serverIndex = Math.floor(Math.random() * serverPublicKeys.length);
        const selectedPublicKey = serverPublicKeys[serverIndex];
        const network = chooseRandomNetwork();
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
