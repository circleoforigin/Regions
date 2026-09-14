const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const appText = fs.readFileSync(path.join(__dirname, '../src/App.tsx'), 'utf8');
const app = ts.createSourceFile('App.tsx', appText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(['canLinkAreaMap', 'linkAreaLocation', 'handleCreateLocation', 'handleCreateExistingLocation']);
const functions = [];
function visit(node) { if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) functions.push(node.getText(app)); ts.forEachChild(node, visit); }
visit(app); assert.equal(functions.length, names.size);
function moduleFile(file) { const exports = {}; vm.runInNewContext(compile(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8')), { exports, require(id) { assert.equal(id, '../assets/default-map.png'); return 'default-map.png'; } }); return exports; }
const resources = moduleFile('sections/AreaResources.ts');
const geometry = moduleFile('sections/SectionGeometry.ts');
const defaults = moduleFile('maps/DefaultMap.ts');
function harness() {
  const area = { id: 'area', kind: 'area', mapId: 'parent', name: 'Forest', featureTypeId: 'forest', edgeIds: ['ab', 'bc', 'ca'], mediaSlotOverrides: [{ slot: 1, media: { fileName: 'forest.png' } }] };
  const parent = { id: 'parent', parentMapId: 'root', mediaSlotOverrides: [] };
  const box = { activeProject: { rootMapId: 'root', mapIds: ['root', 'parent'] }, activeMap: parent,
    activeSections: [area], activeSectionEdges: [{ id: 'ab', startNodeId: 'a', endNodeId: 'b' }, { id: 'bc', startNodeId: 'b', endNodeId: 'c' }, { id: 'ca', startNodeId: 'c', endNodeId: 'a' }],
    activeSectionNodes: [{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b', position: { x: 100, y: 0 } }, { id: 'c', position: { x: 50, y: 100 } }],
    projectMaps: [{ id: 'root' }, parent], pendingMaps: [], locationAreaId: 'area', newLocationPosition: { x: 0, y: 0 },
    newLocationName: 'Detailed Forest', newLocationTypeId: 'forest', newLocationImage: {}, navigationFeatureKind: 'location',
    crypto: { randomUUID: () => 'child' }, ...resources, ...geometry, ...defaults,
    hostedMapImageService: { importLocalFile: async () => ({ id: 'image' }) },
    setActiveProject(value) { box.activeProject = value; },
    setPendingMaps(update) { box.pendingMaps = update(box.pendingMaps); },
    setActiveSections(update) { box.activeSections = update(box.activeSections); },
    closeLocationDialogs() { box.closed = true; }, markProjectDirty() { box.dirty = true; },
  };
  vm.createContext(box); vm.runInContext(compile(functions.join('\n')), box); return box;
}
test('new Area Location uses dialog name, type, image, inherited media and a locked-boundary link', async () => {
  const h = harness(); await h.handleCreateLocation();
  const child = h.pendingMaps[0]; assert.equal(child.name, 'Detailed Forest'); assert.equal(child.featureTypeId, 'forest');
  assert.equal(child.imageFileId, 'image'); assert.equal(child.mediaSlotOverrides[0].media.fileName, 'forest.png');
  assert.equal(child.parentMapId, 'parent'); assert.equal(child.areaBoundaryLink.areaId, 'area');
  assert.equal(child.areaBoundaryLink.alignment.pivotX, 50); assert.equal(child.areaBoundaryLink.alignment.pivotY, 50);
  assert.equal(h.activeSections[0].targetMapId, 'child'); assert.equal(h.closed, true);
});
test('existing Area Location keeps its content and settings and does not create a duplicate Feature', () => {
  const h = harness(); const destination = { id: 'existing', name: 'Old Forest', featureTypeId: 'town', imageFileId: 'old-image', featureIds: ['landmark'], mediaSlotOverrides: [{ slot: 1, media: { fileName: 'old.png' } }] };
  h.handleCreateExistingLocation(destination);
  const linked = h.pendingMaps[0]; assert.equal(linked.name, 'Old Forest'); assert.equal(linked.featureTypeId, 'town');
  assert.equal(linked.imageFileId, 'old-image'); assert.equal(linked.mediaSlotOverrides[0].media.fileName, 'old.png');
  assert.deepEqual(linked.featureIds, ['landmark']); assert.equal(destination.parentMapId, undefined);
  assert.equal(h.activeSections[0].targetMapId, 'existing'); assert.equal(h.closed, true);
});
test('Area linking excludes itself, ancestors, root, other parents and another Area’s destination', () => {
  const h = harness();
  for (const map of [{ id: 'parent' }, { id: 'root' }, { id: 'other', parentMapId: 'elsewhere' }, { id: 'other', areaBoundaryLink: { areaId: 'other-area' } }]) {
    assert.equal(h.canLinkAreaMap(map), false); h.handleCreateExistingLocation(map); assert.equal(h.pendingMaps.length, 0);
  }
  assert.equal(h.canLinkAreaMap({ id: 'existing', parentMapId: 'parent' }), true);
  assert.equal(h.canLinkAreaMap({ id: 'existing' }), true);
});
