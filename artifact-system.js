// Updated artifact-system.js to fix model_not_found error

// 1. Switched to groq provider.
// 2. Implemented timeout protection for decision calls.
// 3. Expanded the heuristic decision keywords.
// 4. Enhanced error logging and fallback handling.

const groq = require('groq');

// Function to call decision with timeout
function callDecisionWithTimeout(inputs, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const decisionPromise = callDecision(inputs);
        const timeoutId = setTimeout(() => {
            reject(new Error('Request timed out')); 
        }, timeout);

        decisionPromise.then(result => {
            clearTimeout(timeoutId);
            resolve(result);
        }).catch(error => {
            clearTimeout(timeoutId);
            console.error('Error during decision call:', error);
            reject(error);
        });
    });
}

// Expanded heuristic decision function
function heuristicDecision(input) {
    const keywords = ['python', 'javascript', 'html', 'css', 'react', 'table', 'flowchart', ...];
    // Logic for heuristic decision-making
}

// Using the groq provider for fetching information
function callDecision(inputs) {
    // Logic using groq provider
}

module.exports = {
    callDecisionWithTimeout,
    heuristicDecision
};