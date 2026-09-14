const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '../src');
function compile(source) {
  return ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
}
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(compile(fs.readFileSync(path.join(root, file), 'utf8')), {
    exports, require: (id) => {
      assert(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return exports;
}
const pieceModel = load('models/Piece.ts');
const api = load('events/LocationEvents.ts', { '../models/Piece': pieceModel });
const geometry = load('sections/SectionGeometry.ts');
const areaResolver = load('sections/AreaContext.ts', { './SectionGeometry': geometry });
const mapContext = { contextKind: 'map', locationId: 'world', locationName: 'World', locationType: 'World' };
const forest = { contextKind: 'area', locationId: 'forest', locationName: 'Forest', locationType: '' };
const piece = { id: 'npc', mapId: 'world', position: { x: 5, y: 5 }, tracked: false };
const plain = (value) => JSON.parse(JSON.stringify(value));

test('untracked, unfocused movement reports entry with exact compact payload', () => {
  const events = plain(api.createLocationEvents('project', piece, 'other', forest, 'movement', mapContext));
  assert.deepEqual(events, [{ type: 'Regions.LocationEntered', payload: {
    projectId: 'project', pieceId: 'npc', tracked: false, focused: false,
    ...forest, previousContextKind: 'map', previousLocationId: 'world',
    previousLocationName: 'World', previousLocationType: 'World',
  }}]);
});
test('focused movement emits entry then host context, with matching destination', () => {
  const events = api.createLocationEvents('project', {...piece,tracked:undefined}, 'npc', forest, 'movement', mapContext);
  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'Regions.LocationEntered');
  assert.equal(events[1].type, 'Regions.LocationContextChanged');
  assert.equal(events[1].payload.reason, 'movement');
  assert.equal(events[1].payload.tracked, true);
  assert.equal(events[1].payload.locationId, events[0].payload.locationId);
  assert(!('previousLocationId' in events[1].payload));
});
test('focus refreshes even the same location, without announcing entry', () => {
  const events = api.createLocationEvents('project', piece, 'npc', forest, 'focus', forest);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'Regions.LocationContextChanged');
  assert.equal(events[0].payload.reason, 'focus');
  assert.equal(api.createLocationEvents('project', piece, 'other', forest, 'focus').length, 0);
});
test('same context movement emits nothing, including after a rename', () => {
  assert.equal(api.createLocationEvents('project', piece, 'npc', {...forest,locationName:'Renamed'}, 'movement', forest).length, 0);
});
test('catalog fields exactly match each emitted payload', () => {
  const events = api.createLocationEvents('project', piece, 'npc', forest, 'movement', mapContext);
  for (const event of events) {
    const definition = api.locationActionDefinitions.find((item) => item.id === event.type);
    assert.deepEqual(Array.from(definition.fields, (field) => field.key).sort(), Object.keys(event.payload).sort());
    for (const field of definition.fields) assert.equal(typeof event.payload[field.key], field.type);
  }
});

const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const source = app.slice(app.indexOf('async function resolvePieceLocation('), app.indexOf('async function restorePersistedSource('));
function harness({focus = 'npc',tracked = true} = {}) {
  const nodes = [[0,0],[10,0],[10,10],[0,10]].map(([x,y],index)=>({id:`n${index}`,position:{x,y}}));
  const edges = nodes.map((node,index)=>({id:`e${index}`,startNodeId:node.id,endNodeId:nodes[(index+1)%4].id}));
  const area = {id:'forest',kind:'area',mapId:'world',name:'Forest',edgeIds:edges.map((edge)=>edge.id)};
  const oldPiece = {...piece,tracked,position:{x:-5,y:5}};
  const activeProject = {id:'project',pieces:[oldPiece],focusedPieceId:focus,featureTypes:[{id:'world-type',name:'World'}],globalMediaSlots:[]};
  const activeMap = {id:'world',name:'World',featureTypeId:'world-type',sectionIds:['forest']};
  const messages = [];
  const sandbox = {activeProject,activeMap,activeSections:[area],activeSectionEdges:edges,activeSectionNodes:nodes,
    loadedSectionsMapId:{current:'world'},pieceAreaContexts:{current:new Map()},pendingMaps:[],projectMaps:[activeMap],
    resolveArea:areaResolver.resolveArea,createLocationEvents:api.createLocationEvents,
    getPartyMembers:pieceModel.getPartyMembers,
    mapRepository:{loadMap:async(id)=>id==='world'?activeMap:null},
    sectionRepository:{loadSections:async()=>[]},sectionEdgeRepository:{loadEdges:async()=>[]},sectionNodeRepository:{loadNodes:async()=>[]},
    resolveMediaSlots:()=>[{mediaType:'image',slot:1,filePath:'test.png',fileName:'test.png',source:'global'}],
    moduleEventBus:{emit:(type,payload)=>messages.push({type,payload:plain(payload)})},
    setNavigationError:(message)=>{throw Error(message);},console,
  };
  vm.createContext(sandbox);vm.runInContext(compile(source),sandbox);
  return {sandbox,messages,area,activeMap,activeProject};
}
test('application movement captures previous context and emits focused image refresh', async()=>{
  const {sandbox,messages,area,activeMap,activeProject}=harness();
  const project={...activeProject,pieces:[{...activeProject.pieces[0],position:{x:5,y:5}}]};
  await sandbox.handleMapEntered(activeMap,project,undefined,'piece','npc',{area,previousArea:undefined});
  assert.deepEqual(messages.map((event)=>event.type),['Regions.LocationEntered','Regions.LocationContextChanged','Regions.EmitImage']);
  assert.equal(messages[0].payload.previousLocationId,'world');
  assert.equal(messages[0].payload.locationId,'forest');
  assert.equal(messages[0].payload.locationType,'');
});
test('Party movement announces every member and only one focused spatial context', async()=>{
  const {sandbox,messages,area,activeMap,activeProject}=harness({focus:'party'});
  const memberA={...activeProject.pieces[0],id:'a',name:'A',position:{x:-5,y:5}};
  const memberB={...activeProject.pieces[0],id:'b',name:'B',tracked:false,position:{x:-5,y:5}};
  const oldParty={...activeProject.pieces[0],id:'party',kind:'group',memberPieceIds:['a','b'],position:{x:-5,y:5}};
  sandbox.activeProject={...activeProject,pieces:[memberA,memberB,oldParty],focusedPieceId:'party'};
  const project={...sandbox.activeProject,pieces:[memberA,memberB,{...oldParty,position:{x:5,y:5}}]};
  await sandbox.handleMapEntered(activeMap,project,undefined,'piece','party',{area,previousArea:undefined});
  assert.deepEqual(messages.map((event)=>event.type),[
    'Regions.LocationEntered','Regions.LocationEntered','Regions.LocationContextChanged','Regions.EmitImage'
  ]);
  assert.deepEqual(messages.slice(0,2).map((event)=>event.payload.pieceId),['a','b']);
  assert.equal(messages[0].payload.focused,false);
  assert.equal(messages[1].payload.tracked,false);
  assert.equal(messages[2].payload.pieceId,'party');
});
test('application cross-map travel resolves both identities without redundant IDs', async()=>{
  const {sandbox,messages,activeProject}=harness({focus:'other',tracked:false});
  const destination={id:'detail',name:'Detailed Forest',sectionIds:[]};
  const project={...activeProject,pieces:[{...activeProject.pieces[0],mapId:'detail'}]};
  await sandbox.handleMapEntered(destination,project,'World','piece','npc');
  assert.equal(messages.length,1);
  assert.equal(messages[0].payload.previousLocationId,'world');
  assert.equal(messages[0].payload.locationId,'detail');
  assert.equal(messages[0].payload.tracked,false);
  assert(!('mapId' in messages[0].payload));
});
test('application focus emits context and images, never entry',async()=>{
  const {sandbox,messages,activeProject,activeMap}=harness();
  await sandbox.handleMapEntered(activeMap,activeProject,undefined,'piece-focus','npc');
  assert.deepEqual(messages.map((event)=>event.type),['Regions.LocationContextChanged','Regions.EmitImage']);
  assert.equal(messages[0].payload.reason,'focus');
});
test('ordinary map browsing with Pieces emits no spatial events',async()=>{
  const {sandbox,messages,activeProject,activeMap}=harness();
  await sandbox.handleMapEntered(activeMap,activeProject,undefined,'manual');
  assert.equal(messages.length,0);
});
test('same-map migration out of an Area reports that Area as previous context',async()=>{
  const {sandbox,messages,activeProject,activeMap}=harness();
  activeProject.pieces[0].position={x:5,y:5};
  const project={...activeProject,pieces:[{...activeProject.pieces[0],position:{x:15,y:5}}]};
  await sandbox.handleMapEntered(activeMap,project,undefined,'piece','npc');
  assert.equal(messages[0].payload.previousLocationId,'forest');
  assert.equal(messages[0].payload.previousContextKind,'area');
  assert.equal(messages[0].payload.locationId,'world');
  assert.equal(messages[0].payload.contextKind,'map');
});
test('same-map migration within one Area emits no event or image refresh',async()=>{
  const {sandbox,messages,activeProject,activeMap}=harness();
  activeProject.pieces[0].position={x:5,y:5};
  const project={...activeProject,pieces:[{...activeProject.pieces[0],position:{x:7,y:5}}]};
  await sandbox.handleMapEntered(activeMap,project,undefined,'piece','npc');
  assert.equal(messages.length,0);
});
test('Area events use the Area Type and image override',async()=>{
  const {sandbox,messages,area,activeProject,activeMap}=harness();
  area.featureTypeId='forest-type';
  area.mediaSlotOverrides=[{slot:1,media:{mediaType:'image',fileName:'forest.png',filePath:'media/forest.png'}}];
  activeProject.featureTypes.push({id:'forest-type',name:'Forest'});
  sandbox.resolveMediaSlots=(_global,_map,overrides)=>overrides.map(item=>({...item.media,slot:item.slot,source:'area'}));
  const project={...activeProject,pieces:[{...activeProject.pieces[0],position:{x:5,y:5}}]};
  await sandbox.handleMapEntered(activeMap,project,undefined,'piece','npc',{area});
  assert.equal(messages[0].payload.locationType,'Forest');
  assert.equal(messages[2].payload.fileName,'forest.png');
});
test('linked Area context reads Type and media from its Location Map',async()=>{
  const {sandbox,messages,area,activeProject,activeMap}=harness();
  area.targetMapId='detail';area.featureTypeId='stale-type';
  sandbox.pendingMaps.push({id:'detail',featureTypeId:'detail-type',mediaSlotOverrides:[{slot:1,media:{mediaType:'image',fileName:'detail.png'}}]});
  activeProject.featureTypes.push({id:'detail-type',name:'Detailed Forest'});
  sandbox.resolveMediaSlots=(_global,overrides)=>overrides.map(item=>({...item.media,slot:item.slot,source:'map'}));
  const project={...activeProject,pieces:[{...activeProject.pieces[0],position:{x:5,y:5}}]};
  await sandbox.handleMapEntered(activeMap,project,undefined,'piece','npc',{area});
  assert.equal(messages[0].payload.locationType,'Detailed Forest');
  assert.equal(messages[2].payload.fileName,'detail.png');
});
