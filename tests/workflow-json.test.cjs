const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const codec = require('../workflow-json.js');
const sample = require('../workflow/seikyu-kappo.js');
const clone = value => JSON.parse(JSON.stringify(value));

test('公開サンプルの全項目・配列順・循環を取込→書出→再取込で保持する', () => {
  const state = codec.parse(JSON.stringify(sample));
  assert.equal(state.nodes.length, 15);
  assert.equal(state.wires.length, 22);
  assert.deepEqual(new Set(state.nodes.map(node => node.role)), new Set(Object.keys(codec.ROLES)));
  assert.equal(state.nodes.filter(node => node.status === 'planned').length, 1);
  const output = codec.toDefinition(state);
  assert.deepEqual(output, sample);
  assert.deepEqual(codec.toDefinition(codec.parse(JSON.stringify(output))), sample);
  assert.deepEqual(state.nodes.map(node => [node.id, node.x, node.y]), codec.fromDefinition(sample).nodes.map(node => [node.id, node.x, node.y]));
  assert.equal(new Set(state.nodes.map(node => JSON.stringify([node.x, node.y]))).size, 15);
  const byId = new Map(state.nodes.map(node => [node.id, node]));
  assert.ok(byId.get('register').y < byId.get('text-extract').y);
  assert.ok(byId.get('text-extract').y < byId.get('text-quality').y);
});

test('未知の拡張項目・危険文字を文字列のまま保持する', () => {
  const input = clone(sample);
  input.extra = { note: '拡張値' };
  input.nodes[0].extra = ['<script>alert(1)</script>', null, { x: true }];
  input.connections[0].extra = { future: 3 };
  input.nodes[0].id = '__proto__';
  input.connections.forEach(wire => {
    if (wire.from === sample.nodes[0].id) wire.from = '__proto__';
    if (wire.to === sample.nodes[0].id) wire.to = '__proto__';
  });
  assert.deepEqual(codec.toDefinition(codec.fromDefinition(input)), input);
});

test('DAGを依存順に配置する（入力ノード順には依存しない）', () => {
  const input = clone(sample);
  input.nodes = ['c', 'b', 'a', 'isolated'].map(id => ({ ...clone(sample.nodes[0]), id }));
  input.connections = [{ from: 'a', to: 'b', on: '' }, { from: 'b', to: 'c', on: '' }];
  const nodes = new Map(codec.fromDefinition(input).nodes.map(node => [node.id, node]));
  assert.ok(nodes.get('a').y < nodes.get('b').y);
  assert.ok(nodes.get('b').y < nodes.get('c').y);
  assert.equal(nodes.get('isolated').y, nodes.get('a').y);
});

test('全ノード循環・自己接続・同じ端点の複数条件・空図を保持する', () => {
  const input = clone(sample);
  input.nodes = input.nodes.slice(0, 2);
  const [a, b] = input.nodes.map(node => node.id);
  input.connections = [{ from: a, to: a, on: '自己接続' }, { from: a, to: b, on: '条件1' }, { from: a, to: b, on: '条件2' }, { from: b, to: a, on: '戻る' }];
  assert.deepEqual(codec.toDefinition(codec.fromDefinition(input)), input);
  input.nodes = [];
  input.connections = [];
  assert.deepEqual(codec.toDefinition(codec.fromDefinition(input)), input);
});

test('編集・移動・削除を出力へ反映し、座標とkindを出力へ混ぜない', () => {
  const state = codec.fromDefinition(sample);
  const node = state.nodes[0];
  node.title = '変更後'; node.description = '新しい作業'; node.role = 'human'; node.status = 'planned'; node.x = 300; node.kind = 'agent';
  const output = codec.toDefinition(state);
  assert.equal(output.nodes[0].name, '変更後');
  assert.equal(output.nodes[0].task, '新しい作業');
  assert.equal(output.nodes[0].role, 'human');
  assert.equal(output.nodes[0].status, 'planned');
  assert.ok(!Object.hasOwn(output.nodes[0], 'x'));
  assert.ok(!Object.hasOwn(output.nodes[0], 'kind'));
  assert.deepEqual(output.nodes[0].learning, sample.nodes[0].learning);
  state.nodes = state.nodes.filter(item => item.id !== node.id);
  state.wires = state.wires.filter(wire => wire.from !== node.id && wire.to !== node.id);
  assert.equal(codec.toDefinition(state).nodes.length, 14);
});

test('不正な型・列挙・重複ID・参照・過大入力を日本語で拒否し、元データを変えない', () => {
  const mutations = [
    input => { input.version = '1'; },
    input => { input.name = ''; },
    input => { input.title = null; },
    input => { input.nodes = null; },
    input => { input.nodes[0] = null; },
    input => { input.nodes[0].id = input.nodes[1].id; },
    input => { input.nodes[0].role = 'api'; },
    input => { input.nodes[0].role = { toString: null }; },
    input => { input.nodes[0].status = 'unknown'; },
    input => { input.nodes[0].task = 3; },
    input => { input.nodes[0].input = '文字'; },
    input => { input.nodes[0].output = [null]; },
    input => { input.nodes[0].impl = {}; },
    input => { delete input.nodes[0].refs; },
    input => { input.nodes[0].verify = [null]; },
    input => { input.nodes[0].verify = [{ check: '' }]; },
    input => { input.nodes[0].verify = [{ check: '検査', impl: [] }]; },
    input => { input.nodes[0].verify = [{ check: '検査', gap: 'yes' }]; },
    input => { input.nodes[0].learning = []; },
    input => { input.nodes[0].learning.manual = [true]; },
    input => { input.connections = {}; },
    input => { input.connections[0] = null; },
    input => { input.connections[0].from = 'missing'; },
    input => { input.connections[0].on = 4; },
    input => { input.nodes = Array(201).fill(input.nodes[0]); },
    input => { input.connections = Array(1001).fill(input.connections[0]); }
  ];
  mutations.forEach(mutate => {
    const input = clone(sample); mutate(input);
    const before = clone(input);
    assert.throws(() => codec.fromDefinition(input), /[ぁ-んァ-ン一-龯]/);
    assert.deepEqual(input, before);
  });
  ['{', 'null', '[]'].forEach(text => assert.throws(() => codec.parse(text), /[ぁ-んァ-ン一-龯]/));
  assert.throws(() => codec.parse(' '.repeat(codec.MAX_BYTES + 1)), /1MB/);
  assert.throws(() => codec.parse(JSON.stringify(sample).slice(0, -1) + ',"extra":1e400}'), /有限/);
  const deep = clone(sample); deep.extra = {};
  let current = deep.extra;
  for (let i = 0; i < 101; i++) { current.child = {}; current = current.child; }
  assert.throws(() => codec.parse(JSON.stringify(deep)), /100階層/);
});

test('index.htmlのインラインJavaScriptの構文が有効', () => {
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
