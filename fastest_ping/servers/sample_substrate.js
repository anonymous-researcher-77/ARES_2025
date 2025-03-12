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

// Substrate contract call
async function callSubstrateContract(functionName, userSURI, args) {
    const provider = new WsProvider('ws://127.0.0.1:9944');  // Connect to Substrate node
    const api = await ApiPromise.create({ provider });  // Create an API instance
    
    // // Contract metadata file, update path to your actual contract ABI
    // const contractMetadata = require('/home/saeed/Desktop/hyperledger_project/substrate-contracts-node/target/ink/substrate_sc/substrate_sc.json'); 
    // const contractAddress = '5FjQ8qYeKR4oGSR2ePpNPDG3KXsThz9gzykkuihNA4Dw7ZDA';  // Contract address
    
    // const contract = new ContractPromise(api, contractMetadata, contractAddress);  // Initialize contract
    // const keyring = new Keyring({ type: 'sr25519' });  // Set up the keyring for SR25519
    // const user = keyring.addFromUri(userSURI);  // Add user from URI (e.g., //Alice)
    
    // // Set the gas limit for the transaction
    // const gasLimit = api.registry.createType('WeightV2', {
    //     refTime: new BN('1000000000000'),
    //     proofSize: new BN('100000000000')
    // });

    // try {
    //     // Call the contract function with provided arguments
    //     const result = await contract.query[functionName](
    //         user.address,  // The address of the user calling the contract
    //         { gasLimit },   // Gas limit for the transaction
    //         ...args         // Pass arguments dynamically
    //     );

    //     // Check if the contract call was successful
    //     if (result.result.isErr) {
    //         throw new Error(`Smart contract call failed: ${result.result.asErr.toString()}`);
    //     }

    //     // Convert result output to JSON and return it
    //     const output = result.output.toJSON();
    //     return output;
    // } catch (error) {
    //     console.error("An error occurred:", error);
    //     throw error;
    // }
}

async function main() {
    const functionName = "add";  // Name of the contract function to call
    const userSURI = "//Alice";  // User's secret URI (can use other URIs for different users)
    const args = [10, 20];       // Arguments to pass to the contract function (e.g., numbers to add)

    try {
        // Call the substrate contract and get the result
        const result = await callSubstrateContract(functionName, userSURI, args);
        console.log(`Function '${functionName}' executed successfully.`);
        console.log(`Result: ${JSON.stringify(result)}`);
    } catch (error) {
        console.error("An error occurred while calling the contract:", error);
    }
}

main().catch(console.error);
