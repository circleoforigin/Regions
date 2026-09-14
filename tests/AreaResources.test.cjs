const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
  }).outputText,{exports,require:id=>{assert(id in deps,id);return deps[id];}});
  return exports;
}
const {copyAreaResourcesToLocation,copyLocationResourcesToArea}=load('sections/AreaResources.ts');
const {resolveMediaSlots}=load('media/MediaSlotResolver.ts');
const media=name=>({fileId:name,filePath:`media/${name}`,fileName:name,mediaType:'image'});
const globals=[{slot:1,media:media('global1')},{slot:2,media:media('global2')},{slot:3,media:media('global3')}];
const parent=[{slot:1,media:media('map1')},{slot:2,media:media('map2')}];
const area={featureTypeId:'forest',mediaSlotOverrides:[{slot:1,media:media('forest1')}]};
const plain=value=>JSON.parse(JSON.stringify(value));
test('Area resources override Map resources and fall back through the Project',()=>{
  const resolved=resolveMediaSlots(globals,parent,area.mediaSlotOverrides);
  assert.deepEqual(Array.from(resolved,item=>item.fileName),['forest1','map2','global3']);
  assert.deepEqual(Array.from(resolved,item=>item.source),['area','map','global']);
  assert.deepEqual(Array.from(resolveMediaSlots(globals,parent),item=>item.fileName),['map1','map2','global3']);
});
test('creating a Location preserves Type and effective media without shared mutable values',()=>{
  const copied=copyAreaResourcesToLocation(area,parent);
  assert.equal(copied.featureTypeId,'forest');
  assert.deepEqual(Array.from(resolveMediaSlots(globals,copied.mediaSlotOverrides),item=>item.fileName),['forest1','map2','global3']);
  copied.mediaSlotOverrides[0].media.fileName='changed';
  assert.equal(area.mediaSlotOverrides[0].media.fileName,'forest1');
  assert.equal(parent[0].media.fileName,'map1');
});
test('unlinking copies the Location’s current settings rather than stale Area settings',()=>{
  const map={featureTypeId:'town',mediaSlotOverrides:[{slot:1,media:media('town1')}]};
  const copied=copyLocationResourcesToArea(map);
  assert.deepEqual(plain(copied),map);
  copied.mediaSlotOverrides[0].media.fileName='changed';
  assert.equal(map.mediaSlotOverrides[0].media.fileName,'town1');
});
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const Editor=load('components/AreaResourcesEditor.tsx',{'react':React,'react/jsx-runtime':require('react/jsx-runtime'),
  '../services/media/HostedMediaService':{hostedMediaService:{}}}).default;
const props={featureTypeId:'forest',overrides:area.mediaSlotOverrides,inheritedOverrides:parent,globalSlots:globals,
  featureTypes:[{id:'forest',name:'Forest'}],onTypeChange:()=>{},onOverridesChange:()=>{},onBusyChange:()=>{}};
test('linked settings display values but offer no media editing controls',()=>{
  const html=renderToStaticMarkup(React.createElement(Editor,{...props,readOnly:true,inheritedOverrides:[]}));
  assert.match(html,/<select[^>]*disabled/);assert.match(html,/Forest/);assert.match(html,/forest1/);
  assert.match(html,/Managed in the linked Location Map/);
  assert.doesNotMatch(html,/type="file"/);assert.doesNotMatch(html,/Use Map \/ Global/);
});
test('unlinked settings expose Type and media editors',()=>{
  const html=renderToStaticMarkup(React.createElement(Editor,{...props,readOnly:false}));
  assert.doesNotMatch(html,/<select[^>]*disabled/);assert.match(html,/type="file"/);
  assert.match(html,/Use Map \/ Global/);assert.match(html,/map2/);
});