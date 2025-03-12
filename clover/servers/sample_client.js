const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function generateFabricProof(txID) {
    try {
        // Path to the connection profile
        const ccpPath = '/home/saeed/Desktop/Project/substrate-contracts-node/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json'; // Path to your connection profile
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Wallet path and identity
        const walletPath = path.join(process.cwd(), '../../enroll_admin/wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        const identity = await wallet.get('SampleUser'); // Replace with your identity

        if (!identity) {
            console.log(`An identity for the user does not exist in the wallet.`);
            return null;
        }

        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'SampleUser', discovery: { enabled: true, asLocalhost: true } });
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('fabric_cc'); // Replace 'fabric_cc' with your contract name

        // Query the transaction proof using txID
        const result = await contract.evaluateTransaction('QueryProof', txID);
        await gateway.disconnect();
        return result.toString(); // Return the proof as a string
    } catch (error) {
        console.error('Error generating Fabric proof:', error);
        throw error;
    }
}

async function main() {
    try {
        const ccpPath = '/home/saeed/Desktop/Project/substrate-contracts-node/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json';
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const walletPath = path.join(process.cwd(), '../../enroll_admin/wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const identity = await wallet.get('SampleUser'); 
        if (!identity) {
            console.log('An identity for the user "FabricUser" does not exist in the wallet');
            return;
        }

        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'SampleUser', discovery: { enabled: true, asLocalhost: true } });

        const network = await gateway.getNetwork('mychannel'); 
        const contract = network.getContract('fabric_cc'); 

        // Submit the transaction
        const result = await contract.submitTransaction('Add', '10', '30'); 
        console.log(`Transaction has been submitted, result is: ${result.toString()}`);

        // Parse the response to extract the transaction ID
        const txID = result.toString().match(/TxID: (\w+)/)[1];

        // Generate the proof for the transaction
        const proof = await generateFabricProof(txID);
        console.log('Fabric Transaction Proof:', proof);

        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
        process.exit(1);
    }
}

main();
