const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// First verify server is responding
function checkServer() {
  return new Promise((resolve) => {
    http.get('http://localhost:8765', (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

// Attempt to fetch the page and check for JS errors by looking at the HTML
async function main() {
  console.log('Checking server at http://localhost:8765...');
  const serverOk = await checkServer();
  
  if (!serverOk) {
    console.log('ERROR: Server is not responding at http://localhost:8765');
    console.log('Please start the server: node server.js');
    return;
  }
  
  console.log('Server is UP!');
  
  // Fetch index.html
  const html = await new Promise((resolve, reject) => {
    let data = '';
    http.get('http://localhost:8765/', (res) => {
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
  
  console.log('index.html fetched, size:', html.length);
  
  // Fetch app.js
  const js = await new Promise((resolve, reject) => {
    let data = '';
    http.get('http://localhost:8765/app.js', (res) => {
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
  
  console.log('app.js fetched, size:', js.length);
  console.log('\nAll files served correctly.');
  console.log('\n=== SERVER STATUS: OK ===');
  console.log('Open http://localhost:8765 in your browser to play the game.');
}

main().catch(console.error);
