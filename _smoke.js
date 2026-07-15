'use strict';
// 起動スモークテスト: 実在idだけ返す疑似DOMでapp.jsを起動し、参照切れを検出
// tickループも数十フレーム回して forming→waiting（脈動）まで実行時例外がないか確認する。
// 使い方: node _smoke.js
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('./index.html', 'utf8');
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

// Canvas 2Dコンテキストの疑似スタブ（全メソッドをno-op、グラデーションだけ生成物を返す）
function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') {
          return () => grad;
        }
        if (prop === 'measureText') return () => ({ width: 0 });
        if (prop in target) return target[prop];
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    }
  );
}

function makeEl(tag) {
  return {
    tagName: (tag || 'div').toUpperCase(),
    children: [], style: {}, dataset: {},
    textContent: '', value: '', src: '', href: '',
    width: 0, height: 0, checked: false, disabled: false,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, f) { if (f === undefined) f = !this._s.has(c); if (f) this._s.add(c); else this._s.delete(c); return f; },
      contains(c) { return this._s.has(c); },
    },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, removeEventListener() {},
    getContext() { return makeCtx(); },
    getBoundingClientRect() { return { top: 0, left: 0, width: 400, height: 700, bottom: 700, right: 400 }; },
    focus() {}, click() {}, remove() {},
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
  };
}

const created = {};
function byId(id) {
  if (!ids.has(id)) return null; // 実在しないid＝本物のブラウザ同様nullを返す→参照切れが例外になる
  if (!created[id]) created[id] = makeEl();
  return created[id];
}

const documentStub = {
  documentElement: Object.assign(makeEl('html'), { lang: '', dir: '' }),
  head: makeEl('head'),
  body: makeEl('body'),
  title: '',
  getElementById: byId,
  createElement: (t) => makeEl(t),
  addEventListener() {},
  querySelector() { return makeEl(); },
  querySelectorAll() { return []; },
};

// tickループを有限回だけ回す疑似requestAnimationFrame（forming→waitingまで進める）
let frame = 0;
function fakeRaf(cb) {
  if (frame++ < 40) cb(frame * 100); // 100ms刻み→約4秒ぶん進めて待機（脈動）に入れる
  return frame;
}

function FakeAudioCtx() {
  return {
    state: 'running', currentTime: 0,
    resume() {}, createGain() { return { gain: { setValueAtTime() {} }, connect() {} }; },
    createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; },
    createBuffer() { return { getChannelData: () => new Float32Array(1) }; },
    destination: {},
  };
}

const sandbox = {
  console,
  document: documentStub,
  navigator: {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { hostname: 'smoke.test', protocol: 'https:' },
  addEventListener() {},
  setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, clearTimeout() {},
  requestAnimationFrame: fakeRaf,
  cancelAnimationFrame() {},
  devicePixelRatio: 1,
  AudioContext: FakeAudioCtx,
  webkitAudioContext: FakeAudioCtx,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

const src = fs.readFileSync('./app.js', 'utf8');
vm.createContext(sandbox);
try {
  vm.runInContext(src, sandbox, { filename: 'app.js' });
  console.log('SMOKE OK: 起動時・tickループに例外なし（' + frame + 'フレーム実行）');
} catch (e) {
  console.log('SMOKE NG:');
  console.log(e.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}
