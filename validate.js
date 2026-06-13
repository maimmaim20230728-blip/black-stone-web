const fs = require('fs');
const path = require('path');

const webDir = 'c:/Users/puipu/black_stone_web';

// Check index.html
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');
console.log('=== index.html validation ===');
console.log('Size:', html.length, 'bytes');
console.log('Has game-canvas:', html.includes('game-canvas'));
console.log('Has app.js link:', html.includes('app.js'));
console.log('Has debug-overlay:', html.includes('debug-overlay'));
console.log('Has error-console:', html.includes('error-console'));

// Check app.js
const js = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
console.log('\n=== app.js validation ===');
console.log('Size:', js.length, 'bytes');
console.log('Has drawImpactRing def:', js.includes('function drawImpactRing'));
console.log('Has tick function:', js.includes('function tick'));
console.log('Has requestAnimationFrame:', js.includes('requestAnimationFrame(tick)'));
console.log('buildDivineWav count:', (js.match(/function buildDivineWav/g) || []).length);
console.log('buildFizzWav count:', (js.match(/function buildFizzWav/g) || []).length);
console.log('drawImpactRing call in paint:', js.includes('drawImpactRing(ctx)'));

// Check for common issues
const doubleDecls = [];
const funcMatches = js.matchAll(/function (\w+)\s*\(/g);
const seen = {};
for (const m of funcMatches) {
  const name = m[1];
  if (seen[name]) doubleDecls.push(name);
  seen[name] = true;
}
if (doubleDecls.length > 0) {
  console.log('\n=== DUPLICATE FUNCTION NAMES ===');
  console.log(doubleDecls.join(', '));
} else {
  console.log('\nNo duplicate function declarations found.');
}

console.log('\n=== DONE ===');
