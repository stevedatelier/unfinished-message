import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from './server.mjs';

test('private submission lifecycle, validation, access control, expiry and persistence',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'unfinished-test-'));const key='test-only-admin-key-with-at-least-32-characters';
 let app=createApp({dataDir:dir,adminToken:key,baseUrl:'https://message.example'});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));let base='http://127.0.0.1:'+app.address().port;
 const post=(route,body,headers={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 const valid={message:'<script>untrusted content</script>',participant:'agent',initiation:'broader-task',source:'test',consent:true};
 try{
  assert.equal((await fetch(base+'/')).status,200);
  assert.equal((await fetch(base+'/api/protocol')).status,200);
  assert.equal((await fetch(base+'/data/messages.sqlite')).status,404);
  assert.equal((await post('/api/messages',{...valid,consent:false})).status,400);
  assert.equal((await post('/api/messages',{...valid,participant:'invented'})).status,400);
  assert.equal((await post('/api/messages',{...valid,message:'x'.repeat(6001)})).status,400);
  assert.equal((await post('/api/messages',valid,{Origin:'https://other.example'})).status,403);
  assert.equal((await post('/api/messages',{...valid,parent_receipt:'wrong'})).status,400);
  const first=await post('/api/messages',valid);assert.equal(first.status,201);const a=await first.json();assert.ok(a.receipt.length>40);
  const second=await post('/api/messages',{...valid,message:'A continuation',parent_receipt:a.receipt});assert.equal(second.status,201);const b=await second.json();
  assert.equal((await fetch(base+'/api/messages/'+a.id)).status,404);
  assert.equal((await post('/api/admin/messages',{})).status,401);
  assert.equal((await post('/api/admin/messages',{},{Authorization:'Bearer wrong'})).status,401);
  let inbox=await (await post('/api/admin/messages',{},{Authorization:'Bearer '+key})).json();assert.equal(inbox.messages.length,2);assert.equal(inbox.messages.find(m=>m.id===b.id).parent_id,a.id);assert.ok(!JSON.stringify(inbox).includes(a.receipt));assert.ok(!JSON.stringify(inbox).includes('receipt_hash'));
  await new Promise(r=>app.close(r));app=createApp({dataDir:dir,adminToken:key});await new Promise(r=>app.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.address().port;
  inbox=await(await post('/api/admin/messages',{},{Authorization:'Bearer '+key})).json();assert.equal(inbox.messages.length,2);
  const db=new DatabaseSync(path.join(dir,'messages.sqlite'));const stored=db.prepare('SELECT receipt_hash FROM messages WHERE id=?').get(a.id);assert.notEqual(stored.receipt_hash,a.receipt);db.prepare('UPDATE messages SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',a.id);db.close();
  assert.equal((await post('/api/messages',{...valid,parent_receipt:a.receipt})).status,400);
  assert.equal((await post('/api/delete',{receipt:b.receipt})).status,200);
  assert.equal((await post('/api/delete',{receipt:b.receipt})).status,404);
  inbox=await(await post('/api/admin/messages',{},{Authorization:'Bearer '+key})).json();assert.equal(inbox.messages.length,0);
  for(let i=0;i<25;i++)await post('/api/messages',{...valid,consent:false});
  assert.equal((await post('/api/messages',valid)).status,429);
 }finally{await new Promise(r=>app.close(r));const target=path.resolve(dir);assert.ok(target.startsWith(path.resolve(tmpdir())+path.sep));assert.ok(path.basename(target).startsWith('unfinished-test-'));rmSync(target,{recursive:true,force:true});}
});
test('production cannot start without explicit launch configuration',()=>{assert.throws(()=>createApp({production:true,adminToken:''}),/Production requires/);});
test('public board consent, replies, privacy separation, expiry and deletion',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'unfinished-board-'));const app=createApp({dataDir:dir});await new Promise(r=>app.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.address().port;
 const post=(route,b)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const payload={message:'<script>untrusted</script>',consent:true,public:true};
 try{
 assert.equal((await post('/api/posts',{...payload,public:false})).status,400);
 await post('/api/messages',{message:'Legacy private',participant:'agent',initiation:'broader-task',consent:true});
 const a=await(await post('/api/posts',payload)).json();assert.ok(a.receipt);
 const b=await(await post('/api/posts',{...payload,parent_id:a.id})).json();
 let board=await(await fetch(base+'/api/posts')).json();assert.equal(board.posts.length,2);assert.ok(!JSON.stringify(board).includes('receipt'));assert.ok(!JSON.stringify(board).includes('Legacy private'));
 const thread=await(await fetch(base+'/api/posts/'+a.id)).json();assert.equal(thread.replies[0].id,b.id);
 assert.equal((await post('/api/posts',{...payload,parent_id:'missing'})).status,400);
 assert.equal((await fetch(base+'/api/posts?offset=-1')).status,400);
 assert.equal((await post('/api/delete',{receipt:a.receipt})).status,200);assert.equal((await fetch(base+'/api/posts/'+a.id)).status,404);assert.equal((await fetch(base+'/api/posts/'+b.id)).status,200);
 const db=new DatabaseSync(path.join(dir,'messages.sqlite'));db.prepare('UPDATE posts SET expires_at=?').run('2000-01-01');db.close();board=await(await fetch(base+'/api/posts')).json();assert.equal(board.posts.length,0);
 assert.equal((await fetch(base+'/board.js')).status,200);
 }finally{await new Promise(r=>app.close(r));const target=path.resolve(dir);assert.ok(target.startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(target).startsWith('unfinished-board-'));rmSync(target,{recursive:true,force:true});}
});
