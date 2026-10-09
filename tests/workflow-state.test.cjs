// ブラウザを起動せず、実際のindex.htmlのイベント処理と保存処理を検証する。
// DOMはイベント登録に必要な最小限だけを代替し、画面描画は対象外。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const codec = require('../workflow-json.js');
const sample = require('../workflow/seikyu-kappo.js');
const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function harness(initial = new Map()) {
  const elements = new Map(), storage = new Map(initial), blobs = [], downloads = [];
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const listeners = new Map();
    const item = {
      id, value: '', files: [], hidden: false, disabled: false, open: false, textContent: '',
      dataset: {}, style: { setProperty() {} },
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(type, callback) { listeners.set(type, callback); },
      fire(type, event = {}) { return listeners.get(type)?.({ preventDefault() {}, stopPropagation() {}, target: item, ...event }); },
      setAttribute() {}, querySelectorAll() { return []; },
      querySelector(selector) { return element(id + selector); },
      showModal() { this.open = true; }, close() { this.open = false; this.fire('close'); },
      click() { if (id === 'a') downloads.push(this.download); else this.fire('click'); }, remove() {}
    };
    elements.set(id, item);
    return item;
  }
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const context = vm.createContext({
    WorkflowJSON: codec, SeikyuWorkflowDefinition: sample, TextEncoder, Blob,
    URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    document: { getElementById: element, querySelectorAll() { return []; }, createElement: element, body: { appendChild() {} } },
    window: { localStorage, setTimeout() {}, clearTimeout() {} }, localStorage,
    requestAnimationFrame() {}
  });
  const source = inline.replace(/\n    workflowState = loadWorkflowState\(app\);\n    updateEditControls\(\);\n    renderWorkflow\(\);\n    renderUiView\(\);\n    renderDataView\(\);\s*$/, '');
  assert.notEqual(source, inline, '起動時の描画呼出を検出できませんでした。');
  vm.runInContext(source + `
    renderWorkflow = () => {}; renderUiView = () => {}; renderDataView = () => {};
    workflowState = loadWorkflowState(app);
    globalThis.subject = {
      state: () => workflowState, appData: APP_DATA, activateApp, defaultWorkflow, normalizeWorkflowState,
      saveWorkflowState, loadWorkflowState, workflowStorageKey, setSeikyuVariant, bindWorkflowNode,
      setState: value => { workflowState = value; },
      setEditing: value => { editing = value; }, select: id => { selectedNodeId = id; },
      variant: () => seikyuVariant
    };
  `, context);
  const subject = context.subject;
  const importText = text => { element('jsonText').value = text; element('jsonImportForm').fire('submit'); };
  return { subject, element, storage, blobs, downloads, importText };
}

test('実取込ハンドラ→書き出しBlob→再取込で全項目一致、ファイル名も正しい', async () => {
  const h = harness(); h.subject.activateApp('seikyu_kappo');
  h.element('importWorkflow').fire('click');
  h.importText(JSON.stringify(sample));
  assert.equal(h.subject.variant(), 'detailed');
  assert.equal(h.element('jsonImportDialog').open, false);
  h.element('exportWorkflow').fire('click');
  const text = await h.blobs[0].text();
  assert.deepEqual(JSON.parse(text), sample);
  assert.deepEqual(h.downloads, ['invoice-sorting.normalized.json']);
  h.importText(text);
  assert.deepEqual(codec.toDefinition(h.subject.state()), sample);
});

test('不正取込はメモリ・保存先・簡易版選択を変えず、日本語エラーを出す', () => {
  const h = harness(); h.subject.activateApp('seikyu_kappo'); h.subject.saveWorkflowState();
  const beforeState = JSON.stringify(h.subject.state()), beforeStorage = new Map(h.storage);
  const invalid = structuredClone(sample); invalid.connections[0].to = 'missing';
  for (const text of ['{', JSON.stringify(invalid), ' '.repeat(codec.MAX_BYTES + 1)]) {
    h.element('importWorkflow').fire('click'); h.importText(text);
    assert.match(h.element('jsonImportError').textContent, /[ぁ-んァ-ン一-龯]/);
    assert.equal(h.element('jsonImportDialog').open, true);
    assert.equal(JSON.stringify(h.subject.state()), beforeState);
    assert.deepEqual(h.storage, beforeStorage);
    assert.equal(h.subject.variant(), 'simple');
  }
});

test('簡易版の編集保持、詳細版の保存・アプリ切替・再起動・リセット', () => {
  const h = harness(); h.subject.activateApp('seikyu_kappo');
  h.subject.state().nodes[0].title = '簡易版の編集'; h.subject.saveWorkflowState();
  h.importText(JSON.stringify(sample));
  h.subject.state().nodes[0].x = 440; h.subject.state().nodes[0].kind = 'chat'; h.subject.saveWorkflowState();
  h.subject.activateApp('aikensyu'); h.subject.activateApp('seikyu_kappo');
  assert.deepEqual(codec.toDefinition(h.subject.state()), sample);
  assert.equal(h.subject.state().nodes[0].x, 440);
  assert.equal(h.subject.state().nodes[0].kind, 'chat');
  h.element('workflowVariant').value = 'simple'; h.element('workflowVariant').fire('change');
  assert.equal(h.subject.state().nodes.length, 4);
  assert.equal(h.subject.state().nodes[0].title, '簡易版の編集');
  h.element('workflowVariant').value = 'detailed'; h.element('workflowVariant').fire('change');
  const restarted = harness(h.storage); restarted.subject.activateApp('seikyu_kappo');
  assert.deepEqual(codec.toDefinition(restarted.subject.state()), sample);
  restarted.element('resetWorkflow').fire('click');
  assert.deepEqual(codec.toDefinition(restarted.subject.state()), sample);
  assert.equal(restarted.subject.loadWorkflowState('seikyu_kappo').nodes[0].x, codec.fromDefinition(sample).nodes[0].x);
});

test('実編集・追加・削除ハンドラも書き出し可能な正規化JSONを保つ', () => {
  const h = harness(); h.subject.activateApp('seikyu_kappo'); h.importText(JSON.stringify(sample));
  h.subject.setEditing(true); h.subject.select(sample.nodes[0].id);
  h.element('nodeTitle').value = '編集した名前'; h.element('nodeDescription').value = '作業の変更'; h.element('nodeType').value = 'agent';
  h.element('nodeRole').value = 'human'; h.element('nodeStatus').value = 'planned'; h.element('nodeForm').fire('submit');
  const edited = codec.toDefinition(h.subject.state()).nodes[0];
  assert.equal(edited.name, '編集した名前'); assert.equal(edited.task, '作業の変更');
  assert.equal(edited.role, 'human'); assert.equal(edited.status, 'planned');
  assert.deepEqual(edited.verify, sample.nodes[0].verify);
  h.element('addNode').fire('click');
  assert.equal(codec.toDefinition(h.subject.state()).nodes.length, 16);
  const node = h.subject.state().nodes.at(-1), rendered = h.element('added-node');
  h.subject.bindWorkflowNode(rendered, node);
  rendered.querySelector('.node-action.delete').fire('click');
  assert.equal(codec.toDefinition(h.subject.state()).nodes.length, 15);
});

test('ファイル読込・サイズ制限・遅い読込結果による貼り付け上書き防止', async () => {
  const h = harness();
  h.element('importWorkflow').fire('click');
  h.element('jsonFile').files = [{ size: 100, text: async () => JSON.stringify(sample) }];
  await h.element('jsonFile').fire('change');
  assert.deepEqual(JSON.parse(h.element('jsonText').value), sample);
  assert.equal(h.element('confirmJsonImport').disabled, false);
  h.element('jsonFile').files = [{ size: codec.MAX_BYTES + 1 }];
  await h.element('jsonFile').fire('change');
  assert.match(h.element('jsonImportError').textContent, /1MB/);
  assert.equal(h.element('confirmJsonImport').disabled, true);
  let finish;
  h.element('jsonFile').files = [{ size: 10, text: () => new Promise(resolve => { finish = resolve; }) }];
  const reading = h.element('jsonFile').fire('change');
  h.element('jsonText').value = '新しい貼り付け'; h.element('jsonText').fire('input');
  finish('古いファイル'); await reading;
  assert.equal(h.element('jsonText').value, '新しい貼り付け');
});

test('既存APP_DATA・3ビューの生成関数・kind装飾のCSSは変更前と一致', () => {
  const before = execFileSync('git', ['show', 'ce5ecc87b3ab95be00833beab6b23e8e300c5166:index.html'], { encoding: 'utf8' });
  const previousInline = before.match(/<script>([\s\S]*?)<\/script>/)[1];
  const dataLiteral = script => script.slice(script.indexOf('    const APP_DATA ='), script.indexOf("    let app = 'aikensyu';"));
  assert.equal(dataLiteral(inline), dataLiteral(previousInline));
  const uiFunctions = script => script.slice(script.indexOf('    function uiEmptyStateMarkup()'), script.indexOf('    function updateEditControls()'));
  assert.equal(uiFunctions(inline), uiFunctions(previousInline));
  const kindCSS = source => source.slice(source.indexOf('    .agent { --accent:'), source.indexOf('    .flow-board > svg'));
  const pinnedAbsolute = '    .workflow-canvas .chat.node, .workflow-canvas .agent.node { position: absolute; }\n';
  assert.ok(html.includes(pinnedAbsolute), 'AIノードは座標どおりに置く(position: absolute)');
  assert.equal(kindCSS(html).replace(pinnedAbsolute, ''), kindCSS(before));
  const h = harness();
  for (const name of ['aikensyu', 'web-service-ginleaf']) {
    h.subject.activateApp(name);
    assert.equal(JSON.stringify(h.subject.state()), JSON.stringify(h.subject.appData[name].workflow));
  }
});
