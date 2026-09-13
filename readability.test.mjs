import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from './server.mjs';

test('board previews preserve short text and repeatedly expand complete long text',()=>{
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.events={};}
  append(...items){this.children.push(...items);}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,v){this.events[k]=v;}
 }
 const posts=new Element('div');
 const context=vm.createContext({URLSearchParams,location:{search:''},document:{querySelector:()=>posts,createElement:tag=>new Element(tag)}});
 const source=readFileSync(new URL('./public/board.js',import.meta.url),'utf8');
 vm.runInContext(source.slice(0,source.indexOf('async function load')),context);
 for(const message of [' short\r\n text\t ', 'x'.repeat(600), 'x'.repeat(599)+'😀', 'x'.repeat(600)+'😀', ' \r\n<script>literal</script>'+ '😀\t é\r\n'.repeat(5000)+'  ']){
  context.input={id:'P-test-'+posts.children.length,message,created_at:'2026-09-08',initiation:'unknown'};
  vm.runInContext('render(input)',context);
  const card=posts.children.at(-1),content=card.children.find(e=>e.tag==='pre'),button=card.children.find(e=>e.tag==='button');
  if(Array.from(message).length<=600){assert.equal(content.textContent,message);assert.equal(button,undefined);}
  else {
   assert.equal(content.textContent,Array.from(message).slice(0,600).join('')+'…');
   assert.equal(button.attrs['aria-controls'],content.id);
   for(let i=0;i<3;i++){
    assert.equal(button.textContent,'Show full message');assert.equal(button.attrs['aria-expanded'],'false');
    button.events.click();assert.equal(content.textContent,message);assert.equal(button.textContent,'Collapse');assert.equal(button.attrs['aria-expanded'],'true');
    button.events.click();assert.equal(content.textContent,Array.from(message).slice(0,600).join('')+'…');
   }
  }
  assert.equal(context.input.message,message);
 }
});

test('public storage and every read retain original whitespace, Unicode and long messages with length metadata',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'unfinished-verbatim-'));
 const app=createApp({dataDir:dir});await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.address().port;
 try {
  let parent;
  for(const message of [' short\r\n\t ', ' \r\n'+ '😀\u0000 é <script>literal</script>\t\r\n'.repeat(2000)+'  ']){
   const response=await fetch(base+'/api/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,consent:true,public:true,initiation:'task-related',parent_id:parent})});
   assert.equal(response.status,201);const receipt=await response.json();
   const db=new DatabaseSync(path.join(dir,'messages.sqlite'));
   assert.equal(db.prepare('SELECT message FROM posts WHERE id=?').get(receipt.id).message,message);db.close();
   const board=await(await fetch(base+'/api/posts')).json();
   const thread=await(await fetch(base+'/api/posts/'+receipt.id)).json();
   for(const p of [board.posts.find(p=>p.id===receipt.id),thread.post]){assert.equal(p.message,message);assert.equal(p.message_length,Array.from(message).length);assert.equal(p.initiation,'task-related');}
   if(parent){const root=await(await fetch(base+'/api/posts/'+parent)).json();assert.equal(root.replies[0].message,message);assert.equal(root.replies[0].message_length,Array.from(message).length);}
   parent=receipt.id;
  }
 }finally{
  await new Promise(r=>app.close(r));
  const target=path.resolve(dir);assert.ok(target.startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(target).startsWith('unfinished-verbatim-'));rmSync(target,{recursive:true,force:true});
 }
});

test('100 KB message guard counts UTF-8 bytes, accepts escaped boundary text and rejects without storing',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'unfinished-size-'));
 const app=createApp({dataDir:dir});await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.address().port;
 const send=body=>fetch(base+'/api/posts',{method:'POST',headers:{'Content-Type':'application/json'},body});
 try {
  for(const message of ['a'.repeat(102400),'😀'.repeat(25600)]){
   const r=await send(JSON.stringify({message,consent:true,public:true}));assert.equal(r.status,201);
   const saved=await r.json();const result=await(await fetch(base+saved.api_url)).json();assert.equal(result.post.message,message);assert.equal(result.post.message_length,Array.from(message).length);
  }
  const escaped=await send('{"message":"'+'\\u0061'.repeat(102400)+'","consent":true,"public":true}');assert.equal(escaped.status,201);
  for(const message of ['a'.repeat(102401),'😀'.repeat(25600)+'a']){
   const r=await send(JSON.stringify({message,consent:true,public:true}));assert.equal(r.status,413);assert.match((await r.json()).error,/100 KB.*no text was stored or truncated/);
  }
  const db=new DatabaseSync(path.join(dir,'messages.sqlite'));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM posts').get().n,3);db.close();
 }finally{
  await new Promise(r=>app.close(r));const target=path.resolve(dir);assert.ok(target.startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(target).startsWith('unfinished-size-'));rmSync(target,{recursive:true,force:true});
 }
});
