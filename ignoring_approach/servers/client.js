const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const https = require('https');
const path = require('path');

// Load public RSA keys for all servers (for encryption)
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

// Load server's signing public keys
const serverSigningPublicKeys = [
    fs.readFileSync('../../signing-keys/server-0-public-key.pem', 'utf8'),
    fs.readFileSync('../../signing-keys/server-1-public-key.pem', 'utf8'),
    fs.readFileSync('../../signing-keys/server-2-public-key.pem', 'utf8'),
    fs.readFileSync('../../signing-keys/server-3-public-key.pem', 'utf8'),
    fs.readFileSync('../../signing-keys/server-4-public-key.pem', 'utf8'),
    fs.readFileSync('../../signing-keys/server-5-public-key.pem', 'utf8'),
    fs.readFileSync('../../signing-keys/server-6-public-key.pem', 'utf8'),
    fs.readFileSync('../../signing-keys/server-7-public-key.pem', 'utf8'),
    fs.readFileSync('../../signing-keys/server-8-public-key.pem', 'utf8'),
    fs.readFileSync('../../signing-keys/server-9-public-key.pem', 'utf8'),
];

// Generate a new AES key
function generateAESKey() {
    return crypto.randomBytes(32); // AES-256 key (32 bytes)
}

// Encrypt AES key with RSA (server's public key)
function encryptRSA(key, publicKey) {
    const buffer = Buffer.from(key);
    return crypto.publicEncrypt(publicKey, buffer);
}

// Encrypt data using AES key
function encryptAES(data, key) {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0)); // 16 bytes IV (initialization vector)
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

// Verify the RSA signature
function verifyRSASignature(data, signature, publicKey) {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'base64');
}

const csvFilePath = path.join(__dirname, 'relay_delays.csv');
// If the CSV file does not exist, create it with headers.
if (!fs.existsSync(csvFilePath)) {
    fs.writeFileSync(csvFilePath, 'timestamp,serverPort,relayDelay\n');
}

/**
 * Appends a CSV row with the timestamp, server port, and measured relay delay.
 * @param {number} serverPort - The port of the server that processed the request.
 * @param {number} delay - The relay delay in milliseconds.
 */
function appendDelayToCSV(serverPort, delay) {
    const timestamp = new Date().toISOString();
    const row = `${timestamp},${serverPort},${delay}\n`;
    fs.appendFileSync(csvFilePath, row, 'utf8');
}

/**
 * Send encrypted request to a specific server and record relay delay.
 */
async function sendRequest(serverPort, selectedPublicKey, functionName, userSURI, args, network, ignore) {
    // Record start time before sending request
    const clientStartTime = Date.now();

    try {
        // Generate a new AES key
        const aesKey = generateAESKey();

        // Encrypt the AES key using the selected server's public RSA key
        const encryptedAESKey = encryptRSA(aesKey, selectedPublicKey);

        // Create the payload with all the data, including 'ignore'
        const payload = {
            functionName,
            userSURI,
            args,
            network,  // Specify "fabric" or "substrate"
            ignore    // Only one server will have ignore set to false
        };

        // Encrypt the payload using the AES key
        const encryptedPayload = encryptAES(payload, aesKey);

        // Convert the encrypted values to base64
        const encryptedAESKeyBase64 = encryptedAESKey.toString('base64');
        const encryptedPayloadBase64 = encryptedPayload;

        // Construct server address
        const serverAddress = `https://localhost:${serverPort}/invoke-smart-contract`;

        // Send the RSA-encrypted AES key and the AES-encrypted payload to the server
        const response = await axios.post(serverAddress, {
            encryptedAESKeyBase64,
            encryptedPayloadBase64
        }, {
            httpsAgent: new https.Agent({
                rejectUnauthorized: false // Accept self-signed certificates for testing
            })
        });

        // Record time after receiving the response.
        const clientEndTime = Date.now();
        const totalDelay = clientEndTime - clientStartTime;

        // The server response may include a relay-specific delay (excluding smart contract invocation time)
        // For example, if your server code sets a field like `relayDelay` in the response.
        const { result, signature, message, relayDelay } = response.data;

        // Calculate the effective relay delay:
        // If the server provides a relayDelay, use that; otherwise, fall back on the total delay.
        const effectiveRelayDelay = typeof relayDelay === 'number' ? relayDelay : totalDelay;

        // Append the delay data to our CSV file.
        appendDelayToCSV(serverPort, effectiveRelayDelay);

        // Process the response normally:
        if (message === 'Request ignored') {
            console.log(`Server ${serverPort} ignored the request. Relay delay: ${effectiveRelayDelay} ms`);
            return;
        }

        if (result && signature) {
            const serverIndex = serverPort - 3000; // Assuming serverPort starts at 3000 for server-0

            // Convert result to string
            const responseData = JSON.stringify(result);

            // Verify the signature using the corresponding server's public signing key
            const isValid = verifyRSASignature(responseData, signature, serverSigningPublicKeys[serverIndex]);
            
            if (isValid) {
                console.log(`Signature is valid from server ${serverPort}.`);
                console.log('Server Response:', result);
            } else {
                console.log(`Invalid signature from server ${serverPort}!`);
            }
        } else {
            console.log(`Server ${serverPort} did not provide valid response data.`);
        }
    } catch (error) {
        if (error.response) {
            console.error(`Error from server ${serverPort}:`, error.response.status, error.response.data);
        } else {
            console.error(`Error from server ${serverPort}:`, error.message);
        }
    }
}

// Randomly choose between Fabric and Substrate
function chooseRandomNetwork() {
    return Math.random() > 0.5 ? 'fabric' : 'substrate';
}

// Send requests to all servers
async function sendRequestsToAllServers() {
    const requests = [];

    for (let i = 0; i < 100; i++) {
        const respondingServerIndex = Math.floor(Math.random() * serverPublicKeys.length);
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

        for (let j = 0; j < serverPublicKeys.length; j++) {
            const serverPort = 3000 + j;
            const selectedPublicKey = serverPublicKeys[j];
            const ignore = j !== respondingServerIndex;

            const requestPromise = sendRequest(serverPort, selectedPublicKey, functionName, userSURI, args, network, ignore);
            requests.push(requestPromise);
        }
    }

    await Promise.all(requests);
}

// Adjust these values as needed.
const NUM_REQUESTS = 1000; // Total number of requests to send
const SERVER_COUNT = serverPublicKeys.length; // Number of relay servers

async function stressTest() {
    const requests = [];

    for (let i = 0; i < NUM_REQUESTS; i++) {
        // Choose a random server index to determine which server should process (ignore = false)
        const respondingServerIndex = Math.floor(Math.random() * SERVER_COUNT);
        const network = chooseRandomNetwork();
        const functionName = 'add';
        let userSURI = network === 'fabric' ? 'SampleUser' : '//Alice';
        let args = network === 'fabric' ? ['10', '20'] : [10, 20];

        // For each relay server, send a request
        for (let j = 0; j < SERVER_COUNT; j++) {
            const serverPort = 3000 + j;
            const selectedPublicKey = serverPublicKeys[j];
            const ignore = j !== respondingServerIndex;

            // Add the request promise to the array
            requests.push(
                sendRequest(serverPort, selectedPublicKey, functionName, userSURI, args, network, ignore)
            );
        }
    }

    // Wait for all requests to finish.
    await Promise.all(requests);
    console.log(`Stress test complete: ${NUM_REQUESTS * SERVER_COUNT} requests sent.`);
}

// Run the stress test.
stressTest();

// Run the requests to all servers
sendRequestsToAllServers();