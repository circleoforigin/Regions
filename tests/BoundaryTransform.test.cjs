const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const exports = {};
  const file = path.join(__dirname, '../src/sections', `${name}.ts`);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (id) => {
    assert(id in dependencies, `Unexpected dependency ${id}`);
    return dependencies[id];
  }});
  return exports;
}
const geometry = load('SectionGeometry');
const { transformBoundaryPoint, deriveAreaBoundary, findBoundaryCrossing, isValidAlignment } =
  load('BoundaryTransform', { './SectionGeometry': geometry });
const alignment = { rotation: 37, zoom: 240, width: 65, height: 180, x: 130, y: -82, pivotX: 5, pivotY: 7 };
const square = [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}];
const area = { id: 'forest', mapId: 'world', name: 'Forest', kind: 'area', color: '#123456',
  createdAt: new Date(), updatedAt: new Date(), edgeIds: [] };

test('rotation, anisotropic scale, zoom and translation round-trip', () => {
  for (let i = -100; i <= 100; i += 1) {
    const point = { x: i * 1.7, y: i * i / 13 };
    const result = transformBoundaryPoint(transformBoundaryPoint(point, alignment), alignment, true);
    assert(Math.abs(result.x-point.x) < 1e-9);
    assert(Math.abs(result.y-point.y) < 1e-9);
  }
});
test('pivot maps to position, with predictable independent axis scale', () => {
  const value = {...alignment,rotation:0,zoom:100,width:200,height:50};
  const result=transformBoundaryPoint({x:value.pivotX+3,y:value.pivotY+4},value);
  assert.equal(result.x,value.x+6);assert.equal(result.y,value.y+2);
});
test('invalid transforms cannot become singular', () => {
  for (const key of ['zoom','width','height']) {
    assert.equal(isValidAlignment({...alignment,[key]:0}),false);
    assert.throws(()=>transformBoundaryPoint({x:1,y:2},{...alignment,[key]:-1}));
  }
  assert.equal(isValidAlignment({...alignment,x:NaN}),false);
});
test('derived Boundary follows Area edits without mutating its source', () => {
  const before=JSON.stringify(square);
  const first=deriveAreaBoundary('detail',area,square,alignment);
  assert.equal(first.section.locked,true);assert.equal(first.section.kind,'boundary');
  assert.equal(first.nodes.length,4);assert.equal(first.edges.length,4);
  const expanded=[...square,{x:-2,y:5}];
  const second=deriveAreaBoundary('detail',area,expanded,alignment);
  assert.equal(second.section.id,first.section.id);assert.equal(second.nodes.length,5);
  assert.equal(JSON.stringify(square),before);
  const polygon=geometry.getSectionPolygon(first.section,first.edges,first.nodes);
  assert(geometry.isPointInPolygon(transformBoundaryPoint({x:5,y:5},alignment),polygon));
});
test('entry and exit use first actual crossing, even for a long drag', () => {
  const entry=findBoundaryCrossing({x:-5,y:5},{x:15,y:5},square,true);
  assert(entry);assert(geometry.isPointInPolygon(entry.position,square));
  assert(Math.abs(entry.position.x)<0.01);
  const exit=findBoundaryCrossing({x:5,y:5},{x:15,y:5},square,false);
  assert(exit);assert(!geometry.isPointInPolygon(exit.position,square));
  assert(exit.position.x>10 && exit.position.x<10.01);
});
test('no transition for tangent, stationary or same-context movement', () => {
  assert.equal(findBoundaryCrossing({x:-5,y:-5},{x:5,y:-5},square,true),undefined);
  assert.equal(findBoundaryCrossing({x:5,y:5},{x:5,y:5},square,false),undefined);
  assert.equal(findBoundaryCrossing({x:2,y:2},{x:8,y:8},square,false),undefined);
});