// 正規化JSONと、表示用nodes/wiresの変換。外部ライブラリ不要。
(function (root) {
  'use strict';
  const ROLES = { calculator: '電卓', sorter: '仕分け', judge: '判断', human: '人' };
  const MAX_BYTES = 1024 * 1024;
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const fail = message => { throw new Error(message); };

  function string(value, path, required = false) {
    if (typeof value !== 'string') fail(path + ' は文字列で指定してください。');
    if (required && !value.trim()) fail(path + ' は空にできません。');
    if (value.length > 10000) fail(path + ' は10,000文字以内にしてください。');
  }

  function strings(value, path) {
    if (!Array.isArray(value)) fail(path + ' は文字列の配列で指定してください。');
    value.forEach((item, index) => string(item, path + '[' + index + ']'));
  }

  function validate(definition) {
    if (!object(definition)) fail('JSONの最上位はオブジェクトで指定してください。');
    // 拡張項目も無損失で保持できるJSON値かを確認する。
    const stack = [{ value: definition, depth: 0 }];
    while (stack.length) {
      const { value, depth } = stack.pop();
      if (depth > 100) fail('JSONの入れ子は100階層以内にしてください。');
      if (typeof value === 'number' && !Number.isFinite(value)) fail('JSONの数値は有限の値で指定してください。');
      if (value && typeof value === 'object') {
        Object.values(value).forEach(child => stack.push({ value: child, depth: depth + 1 }));
      } else if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
        fail('JSONで表現できない値が含まれています。');
      }
    }
    if (definition.version !== 1) fail('対応する version は数値の1です。');
    string(definition.name, 'name', true);
    string(definition.title, 'title', true);
    if (!Array.isArray(definition.nodes)) fail('nodes は配列で指定してください。');
    if (!Array.isArray(definition.connections)) fail('connections は配列で指定してください。');
    if (definition.nodes.length > 200) fail('ノードは200件以内にしてください。');
    if (definition.connections.length > 1000) fail('接続は1,000件以内にしてください。');
    const ids = new Set();
    definition.nodes.forEach((node, index) => {
      const path = 'nodes[' + index + ']';
      if (!object(node)) fail(path + ' はオブジェクトで指定してください。');
      string(node.id, path + '.id', true);
      if (ids.has(node.id)) fail('ノードID「' + node.id + '」が重複しています。');
      ids.add(node.id);
      string(node.name, path + '.name', true);
      if (typeof node.role !== 'string' || !Object.hasOwn(ROLES, node.role)) fail(path + '.role は calculator / sorter / judge / human のいずれかです。');
      if (!['implemented', 'planned'].includes(node.status)) fail(path + '.status は implemented / planned のいずれかです。');
      string(node.task, path + '.task');
      ['input', 'output', 'impl', 'refs'].forEach(key => strings(node[key], path + '.' + key));
      if (!Array.isArray(node.verify)) fail(path + '.verify は検証項目の配列で指定してください。');
      node.verify.forEach((entry, i) => {
        const at = path + '.verify[' + i + ']';
        if (!object(entry)) fail(at + ' はオブジェクトで指定してください。');
        string(entry.check, at + '.check', true);
        if (Object.hasOwn(entry, 'impl')) string(entry.impl, at + '.impl');
        if (Object.hasOwn(entry, 'gap') && typeof entry.gap !== 'boolean') fail(at + '.gap は真偽値で指定してください。');
      });
      if (!object(node.learning)) fail(path + '.learning はオブジェクトで指定してください。');
      ['cases', 'fix_notes', 'manual'].forEach(key => strings(node.learning[key], path + '.learning.' + key));
    });
    definition.connections.forEach((wire, index) => {
      const path = 'connections[' + index + ']';
      if (!object(wire)) fail(path + ' はオブジェクトで指定してください。');
      string(wire.from, path + '.from', true);
      string(wire.to, path + '.to', true);
      string(wire.on, path + '.on');
      if (!ids.has(wire.from) || !ids.has(wire.to)) fail(path + ' が存在しないノードIDを参照しています。');
    });
    return definition;
  }

  // DFSの戻り辺を配置計算からのみ除き、残る依存を上から下へ並べる。
  // 循環・自己接続も元のwiresには全て保持する。
  function layout(definition) {
    const ids = definition.nodes.map(node => node.id);
    const outgoing = new Map(ids.map(id => [id, []]));
    const incoming = new Map(ids.map(id => [id, 0]));
    definition.connections.forEach(wire => {
      outgoing.get(wire.from).push(wire.to);
      incoming.set(wire.to, incoming.get(wire.to) + 1);
    });
    const visited = new Set(), active = new Set(), order = [], backEdges = new Set();
    function visit(id) {
      if (visited.has(id)) return;
      visited.add(id);
      active.add(id);
      outgoing.get(id).forEach(to => {
        if (active.has(to)) backEdges.add(JSON.stringify([id, to]));
        else visit(to);
      });
      active.delete(id);
      order.push(id);
    }
    ids.filter(id => incoming.get(id) === 0).forEach(visit);
    ids.forEach(visit);
    const levels = new Map(ids.map(id => [id, 0]));
    order.reverse().forEach(id => outgoing.get(id).forEach(to => {
      if (!backEdges.has(JSON.stringify([id, to]))) levels.set(to, Math.max(levels.get(to), levels.get(id) + 1));
    }));
    const lanes = new Map();
    return new Map(ids.map(id => {
      const level = levels.get(id), lane = lanes.get(level) || 0;
      lanes.set(level, lane + 1);
      return [id, { x: 45 + lane * 300, y: 160 + level * 210 }];
    }));
  }

  function fromDefinition(input) {
    const definition = copy(validate(input));
    const positions = layout(definition);
    return {
      definition,
      note: definition.title + '（' + definition.name + '） — ノードを選ぶと詳細を表示 / 戻り配線は破線',
      groups: [],
      nextId: 1,
      nodes: definition.nodes.map((node, index) => ({
        id: node.id, displayId: 'N' + String(index + 1).padStart(2, '0'),
        ...positions.get(node.id), kind: 'none', role: node.role, status: node.status,
        title: node.name, description: node.task, definition: node
      })),
      wires: definition.connections.map((wire, index) => ({ id: 'w' + (index + 1), ...wire, definition: wire }))
    };
  }

  function parse(text) {
    if (new TextEncoder().encode(text).length > MAX_BYTES) fail('JSONは1MB以内にしてください。');
    let input;
    try { input = JSON.parse(text); } catch (error) { fail('JSONの構文が不正です。引用符・カンマ・括弧を確認してください。'); }
    return fromDefinition(input);
  }

  function toDefinition(state) {
    if (!state || !state.definition) fail('正規化JSONを取り込むか、請求書整理の詳細版を選んでください。');
    const result = copy(state.definition);
    result.nodes = state.nodes.map(node => ({
      ...copy(node.definition), id: node.id, name: node.title, task: node.description,
      role: node.role, status: node.status
    }));
    result.connections = state.wires.map(wire => ({ ...copy(wire.definition), from: wire.from, to: wire.to, on: wire.on }));
    return copy(validate(result));
  }

  const api = { ROLES, MAX_BYTES, validate, layout, parse, fromDefinition, toDefinition };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorkflowJSON = api;
})(typeof globalThis === 'object' ? globalThis : this);
