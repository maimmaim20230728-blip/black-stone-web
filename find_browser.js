const fs = require('fs');
const path = require('path');

// Common browser locations on Windows
const browserPaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe',
];

for (const p of browserPaths) {
  if (fs.existsSync(p)) {
    console.log('FOUND:', p);
  } else {
    console.log('not found:', p);
  }
}
