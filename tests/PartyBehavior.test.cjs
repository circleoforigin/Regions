const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '../src');
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const pieceExports = {};
vm.runInNewContext(compile(fs.readFileSync(path.join(root, 'models/Piece.ts'), 'utf8')),
  { exports: pieceExports });

const appText = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const sourceFile = ts.createSourceFile(
  'App.tsx', appText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX
);
const functionNames = new Set([
  'partyMemberPosition',
  'handlePartyDrop',
  'handleRemovePartyMember',
  'handleDisbandParty',
]);
const functions = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && functionNames.has(node.name?.text)) {
    functions.push(node.getText(sourceFile));
  }
  ts.forEachChild(node, visit);
}
visit(sourceFile);
assert.equal(functions.length, functionNames.size);

const appearance = { shape: 'circle', fillColor: '#eee', borderColor: '#222' };
const individual = (id, options = {}) => ({
  id, kind: 'piece', name: id.toUpperCase(), mapId: 'map',
  position: { x: 0, y: 0 }, appearance, tracked: options.tracked,
});
const party = (id, members, options = {}) => ({
  id, kind: 'group', name: id, mapId: 'map', position: options.position ?? { x: 20, y: 20 },
  appearance, tracked: options.tracked, memberPieceIds: members,
});

function harness(pieces, focusedPieceId) {
  const sandbox = {
    activeProject: { id: 'project', pieces, focusedPieceId },
    crypto: { randomUUID: () => 'new-party' },
    ...pieceExports,
    setActiveProject(project) { sandbox.activeProject = project; },
    markProjectDirty() { sandbox.dirty = true; },
    Math, Date, Set,
  };
  vm.createContext(sandbox);
  vm.runInContext(compile(functions.join('\n')), sandbox);
  return sandbox;
}

test('Piece onto Piece creates a Party without deleting either member', () => {
  const h = harness([individual('a'), individual('b', { tracked: false })], 'a');
  h.handlePartyDrop('a', 'b');
  const created = h.activeProject.pieces.find((piece) => piece.id === 'new-party');
  assert.equal(created.kind, 'group');
  assert.deepEqual(Array.from(created.memberPieceIds), ['b', 'a']);
  assert.deepEqual(created.position, { x: 0, y: 0 });
  assert.equal(h.activeProject.pieces.length, 3);
  assert.equal(h.activeProject.pieces.find((piece) => piece.id === 'b').tracked, false);
  assert.equal(h.activeProject.focusedPieceId, 'new-party');
});

test('Piece onto Party adds the Piece and preserves the target Party', () => {
  const h = harness([individual('a'), individual('b'), individual('c'), party('target', ['a','b'])]);
  h.handlePartyDrop('c', 'target');
  assert.deepEqual(Array.from(h.activeProject.pieces.find((piece) => piece.id === 'target').memberPieceIds), ['a','b','c']);
  assert.equal(h.activeProject.pieces.filter((piece) => piece.kind === 'group').length, 1);
});

test('Party onto Piece preserves the source Party identity', () => {
  const h = harness([individual('a'), individual('b'), individual('c'), party('source', ['a','b'])]);
  h.handlePartyDrop('source', 'c');
  assert.deepEqual(Array.from(h.activeProject.pieces.find((piece) => piece.id === 'source').memberPieceIds), ['c','a','b']);
});

test('Party onto Party merges into target, removes source, and transfers focus', () => {
  const h = harness([
    individual('a'), individual('b'), individual('c'), individual('d'),
    party('source', ['a','b']), party('target', ['c','d']),
  ], 'source');
  h.handlePartyDrop('source', 'target');
  assert.equal(h.activeProject.pieces.some((piece) => piece.id === 'source'), false);
  assert.deepEqual(Array.from(h.activeProject.pieces.find((piece) => piece.id === 'target').memberPieceIds), ['c','d','a','b']);
  assert.equal(h.activeProject.focusedPieceId, 'target');
});

test('removing down to one member dissolves Party and restores metadata', () => {
  const a = individual('a', { tracked: false });
  const h = harness([a, individual('b'), party('party', ['a','b'])], 'party');
  h.handleRemovePartyMember('party', 'a');
  assert.equal(h.activeProject.pieces.some((piece) => piece.id === 'party'), false);
  assert.equal(h.activeProject.pieces.find((piece) => piece.id === 'a').tracked, false);
  assert.equal(h.activeProject.pieces.find((piece) => piece.id === 'a').mapId, 'map');
  assert.equal(h.activeProject.focusedPieceId, 'b');
});

test('disband removes only the Party and restores every member around it', () => {
  const h = harness([individual('a'), individual('b'), individual('c'), party('party', ['a','b','c'])], 'party');
  h.handleDisbandParty('party');
  assert.deepEqual(h.activeProject.pieces.map((piece) => piece.id), ['a','b','c']);
  assert.equal(new Set(h.activeProject.pieces.map((piece) =>
    `${piece.position.x}:${piece.position.y}`)).size, 3);
  assert.equal(h.activeProject.focusedPieceId, 'a');
});
