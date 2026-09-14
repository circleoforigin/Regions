const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');
function harness(targetMapId) {
  let cursor = 0; const hooks = []; const actions = []; let updates = 0;
  const state = { editingMode: 'browse', viewport: { scale: 1, panX: 0, panY: 0 }, selectedFeaturePopupOffset: { x: 0, y: 0 } };
  const react = { Fragment: Symbol('Fragment'), forwardRef: fn => fn, useEffect() {}, useImperativeHandle() {},
    useRef(value) { const i = cursor++; return hooks[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof value === 'function' ? value() : value;
      if (hooks[i]?.width === 0) hooks[i] = { width: 1000, height: 1000 };
      return [hooks[i], next => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }]; } };
  function load(file) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
    }).outputText, { exports, require(id) {
      if (id === 'react') return react;
      if (id === 'react/jsx-runtime') return jsx;
      if (id.endsWith('RegionsStateContext')) return { useRegionsState: () => ({ state, dispatch(action) { actions.push(action); if (action.type === 'feature.select') state.selectedFeatureId = action.featureId;
        if (action.type === 'featureMove.start') { state.editingMode = 'move-feature'; state.movingFeatureId = action.featureId; state.movingFeaturePreviewPosition = action.position; }
        if (action.type === 'featureMove.preview') state.movingFeaturePreviewPosition = action.position;
        if (action.type === 'featureMove.cancel') { state.editingMode = 'browse'; state.movingFeatureId = null; state.movingFeaturePreviewPosition = null; } } }) };
      if (id.endsWith('useProximityDismiss')) return { useProximityDismiss() {} };
      if (/MapKey|RichTextEditor|AreaMediaSlotsDialog/.test(id)) return { __esModule: true, default: id.split('/').at(-1) };
      return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id)) + '.ts');
    }, window: { confirm: () => true }, Date, Set, Map });
    return exports;
  }
  const props = { edgeScrollingEnabled: false, mapId: 'map', features: [], featureTypes: [{ id: 'forest', name: 'Forest' }],
    sections: [{ id: 'area', name: 'Amtar', kind: 'area', color: '#008800', targetMapId, edgeIds: ['ab', 'bc', 'ca'] }],
    sectionNodes: [{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b', position: { x: 100, y: 0 } }, { id: 'c', position: { x: 50, y: 100 } }],
    sectionEdges: [{ id: 'ab', startNodeId: 'a', endNodeId: 'b' }, { id: 'bc', startNodeId: 'b', endNodeId: 'c' }, { id: 'ca', startNodeId: 'c', endNodeId: 'a' }],
    locationMaps: [{ id: 'child', featureTypeId: 'forest' }],
    onUpdateSectionData(sections) { props.sections = sections; updates++; },
    onAddAreaLocation(area) { actions.push({ type: 'add-location', id: area.id }); },
    onDeleteSection(id) { actions.push({ type: 'delete', id }); },
    onOpenAreaLocation(area) { actions.push({ type: 'enter', id: area.targetMapId }); },
  };
  const Viewport = load('components/MapViewport.tsx').default;
  const render = () => { cursor = 0; const tree = Viewport(props, null); tree.props.ref.current = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000 }) }; return tree; };
  function nodes(root) { if (!root || typeof root !== 'object') return []; if (Array.isArray(root)) return root.flatMap(nodes); return [root, ...nodes(root.props?.children)]; }
  function find(predicate) { const result = nodes(render()).find(predicate); assert.ok(result, 'Expected UI element: ' + nodes(render()).map(n => typeof n.type === 'object' ? JSON.stringify(n.type) : String(n.type)).join(',')); return result; }
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  const button = label => find(n => n.type === 'button' && text(n) === label);
  const select = () => find(n => n.props?.className === 'area-control-node').props.onClick({ stopPropagation() {}, detail: 0 });
  return { props, state, actions, find, button, select, get updates() { return updates; } };
}
test('Area click selects shared popup; edits update the Area without a duplicate Feature', () => {
  const h = harness(); h.select();
  const editor = h.find(n => n.type === 'RichTextEditor');
  editor.props.onChange('A deep forest');
  assert.equal(h.props.sections[0].description, 'A deep forest');
  assert.equal(h.props.features.length, 0);
  h.button('Amtar').props.onClick();
  h.find(n => n.props?.className === 'feature-popup-name-input').props.onChange({ target: { value: 'Blackwood' } });
  h.find(n => n.props?.className === 'feature-popup-name-input').props.onBlur();
  assert.equal(h.props.sections[0].name, 'Blackwood');
  h.button('Actions ▾').props.onClick(); h.button('Add Location').props.onClick();
  assert.deepEqual(h.actions.at(-1), { type: 'add-location', id: 'area' });
});
test('linked Area uses Map settings and its Location navigation callback', () => {
  const h = harness('child'); h.select();
  h.button('Actions ▾').props.onClick(); h.button('Media Assignment…').props.onClick();
  const editor = h.find(n => n.type === 'AreaMediaSlotsDialog');
  assert.equal(editor.props.readOnly, true);
  editor.props.onClose();
  h.button('Actions ▾').props.onClick(); h.button('Enter').props.onClick();
  assert.deepEqual(h.actions.at(-1), { type: 'enter', id: 'child' });
});
test('pointer click selects without saving a moved control position', () => {
  const h = harness();
  const event = { stopPropagation() {}, preventDefault() {}, button: 0, pointerId: 1, clientX: 20, clientY: 20,
    currentTarget: { setPointerCapture() {}, hasPointerCapture() { return false; } } };
  h.find(n => n.props?.className === 'area-control-node').props.onPointerDown(event);
  assert.equal(h.find(n => n.props?.className === 'area-control-node').props.onPointerMove, undefined);
  h.find(n => n.props?.className === 'area-control-node').props.onClick(event);
  assert.equal(h.state.selectedFeatureId, 'area'); assert.equal(h.updates, 0);
});

test('Area context menu controls labels, color, deletion, and constrained Move placement', () => {
  const h = harness();
  const context = () => h.find(n => n.props?.className === 'area-control-node').props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 550, clientY: 530 });
  context(); h.button('Show Label').props.onClick(); assert.equal(h.props.sections[0].showName, true);
  context(); h.find(n => n.props?.['aria-label'] === 'Area color').props.onChange({ target: { value: '#ff0000' } });
  assert.equal(h.props.sections[0].color, '#ff0000');
  h.button('Move').props.onClick(); assert.equal(h.state.editingMode, 'move-feature');
  const before = h.updates;
  const place = (x,y) => h.find(n => n.props?.className?.startsWith('map-viewport')).props.onPointerDown({ button: 0, clientX: x, clientY: y, preventDefault() {} });
  place(900, 900); assert.equal(h.updates, before); assert.equal(h.state.editingMode, 'move-feature');
  place(550, 530); assert.equal(h.state.editingMode, 'browse');
  assert.equal(h.props.sections[0].controlPosition.x, 50); assert.equal(h.props.sections[0].controlPosition.y, 30);
  context(); h.button('Delete').props.onClick(); assert.deepEqual(h.actions.at(-1), { type: 'delete', id: 'area' });
});
test('Area media dialog saves overrides to the Area', () => {
  const h = harness(); h.select(); h.button('Actions ▾').props.onClick(); h.button('Media Assignment…').props.onClick();
  const dialog = h.find(n => n.type === 'AreaMediaSlotsDialog'); assert.equal(dialog.props.readOnly, false);
  const overrides = [{ slot: 1, media: { fileName: 'forest.png' } }];
  dialog.props.onSave(overrides); assert.deepEqual(h.props.sections[0].mediaSlotOverrides, overrides);
});
