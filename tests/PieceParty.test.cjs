const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/models/Piece.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText, { exports: exportsObject });

const {
  findContainingParty,
  getPartyMembers,
  isPieceGrouped,
  movePartyAndMembers,
  resolveSpatialPiece,
} = exportsObject;

const appearance = { shape: 'circle', fillColor: '#fff', borderColor: '#000' };
const a = { id: 'a', kind: 'piece', name: 'A', mapId: 'map-1', position: { x: 1, y: 1 }, appearance, tracked: false };
const b = { id: 'b', kind: 'piece', name: 'B', mapId: 'map-1', position: { x: 2, y: 2 }, appearance };
const party = { id: 'party', kind: 'group', name: 'Party', mapId: 'map-1', position: { x: 5, y: 5 }, appearance, memberPieceIds: ['a','b'] };
const pieces = [a,b,party];

test('membership helpers preserve individual Piece identity and resolve its Party', () => {
  assert.equal(findContainingParty('a', pieces).id, 'party');
  assert.equal(isPieceGrouped('b', pieces), true);
  assert.equal(resolveSpatialPiece('a', pieces).id, 'party');
  assert.equal(resolveSpatialPiece('party', pieces).id, 'party');
  assert.deepEqual(Array.from(getPartyMembers(party, pieces), (piece) => piece.id), ['a','b']);
  assert.equal(getPartyMembers(party, pieces)[0].tracked, false);
});

test('moving a Party moves its identity and member mapIds without replacing member metadata', () => {
  const moved = movePartyAndMembers(pieces, 'party', 'map-2', { x: 20, y: 30 });
  assert.deepEqual(moved.find((piece) => piece.id === 'party').position, { x: 20, y: 30 });
  assert.equal(moved.find((piece) => piece.id === 'a').mapId, 'map-2');
  assert.deepEqual(moved.find((piece) => piece.id === 'a').position, { x: 1, y: 1 });
  assert.equal(moved.find((piece) => piece.id === 'a').tracked, false);
});
