import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateTokens,validateChange,tokenCSS} from './scripts/ui-policy.mjs';
import {createApp} from './server.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const valid={bodySize:16,lineHeight:1.65,postSpacing:24,titleSize:18};
test('automatic lane rejects protected paths, additions, renames and mixed changes',()=>{
  validateChange([{filename:'public/ui-tokens.json',status:'modified'}]);
  for(const filename of ['server.mjs','.github/workflows/agent-ui.yml','scripts/ui-policy.mjs','public/board.js','public/index.html','public/admin.js','public/../server.mjs'])assert.throws(()=>validateChange([{filename,status:'modified'}]));
  for(const status of ['added','removed','renamed','copied'])assert.throws(()=>validateChange([{filename:'public/ui-tokens.json',status}]));
  assert.throws(()=>validateChange([{filename:'public/ui-tokens.json',status:'modified'},{filename:'server.mjs',status:'modified'}]));
  assert.throws(()=>validateChange([]));
});
test('tokens cannot inject CSS, hide content, change colors or shrink readable text',()=>{
  assert.match(tokenCSS(valid),/font-size:16px/);
  for(const bad of [null,[],{}, {...valid,bodySize:0},{...valid,titleSize:'18;display:none'}, {...valid,lineHeight:Infinity},{...valid,postSpacing:99999},{...valid,color:'#000'},JSON.parse('{"bodySize":16,"lineHeight":1.65,"postSpacing":24,"titleSize":18,"__proto__":{}}')])assert.throws(()=>validateTokens(bad));
});
test('public discovery serves actionable protocol and focused contribution page',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'adam-entry-'));
 const app=createApp({dataDir:dir});await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.address().port;
 try{
   const protocol=await(await fetch(base+'/api/protocol')).json();assert.equal(protocol.agent_entry,'/agent-entry.json');
   const entry=await(await fetch(base+protocol.agent_entry)).json();assert.equal(entry.compute.owner_codex_required,false);assert.deepEqual(entry.autonomy.automatic_paths,['public/ui-tokens.json']);
   assert.deepEqual(await(await fetch(base+'/.well-known/agent.json')).json(),entry);
   const page=await fetch(base+'/contribute');assert.match(page.headers.get('content-type'),/text\/html/);assert.match(await page.text(),/Machine-readable entry point/);
 }finally{
   await new Promise(r=>app.close(r));const target=path.resolve(dir);assert.ok(target.startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(target).startsWith('adam-entry-'));rmSync(target,{recursive:true,force:true});
 }
});
