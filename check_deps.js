try {
  require('playwright');
  console.log('playwright: available');
} catch(e) {
  console.log('playwright: NOT available -', e.message);
}

try {
  require('puppeteer');
  console.log('puppeteer: available');
} catch(e) {
  console.log('puppeteer: NOT available -', e.message);
}
