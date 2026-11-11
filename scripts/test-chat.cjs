const assert=require('node:assert/strict');
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocs,updateDoc,deleteDoc,collection,query,where,orderBy,limit,startAfter,Timestamp,setLogLevel}=require('firebase/firestore');
setLogLevel('silent');
const project='demo-dalryo';
async function signup(){const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});const d=await r.json();assert.ok(d.idToken);return {uid:d.localId,token:d.idToken};}
async function call(user,action,input={}){const r=await fetch(`http://127.0.0.1:5001/${project}/asia-northeast3/socialAction`,{method:'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${user.token}`}:{})},body:JSON.stringify({data:{action,...input}}),signal:AbortSignal.timeout(30000)});const d=await r.json();if(d.error)throw Object.assign(new Error(d.error.message),{code:d.error.status});assert.ok(r.ok,JSON.stringify(d));return d.result;}
(async()=>{
const env=await initializeTestEnvironment({projectId:project,firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});let passed=0;
const test=async(name,fn)=>{await fn();console.log(`PASS ${name}`);passed++;};
const admin=async fn=>{let result;await env.withSecurityRulesDisabled(async ctx=>{result=await fn(ctx.firestore());});return result;};
const read=path=>admin(async db=>(await getDoc(doc(db,path))).data());
try{
 await env.clearFirestore();const a=await signup(),b=await signup(),c=await signup();
 await admin(async db=>{for(const [i,u] of [a,b,c].entries())await setDoc(doc(db,`users/${u.uid}`),{uid:u.uid,display_name:['Alice','Bob','Eve'][i],profile_image:null,email:'private@example.test',phone:'private',notification_settings:{push:false}});});
 const alice=env.authenticatedContext(a.uid).firestore(),bob=env.authenticatedContext(b.uid).firestore(),eve=env.authenticatedContext(c.uid).firestore(),guest=env.unauthenticatedContext().firestore();
 let id;const base=()=>`conversations/${id}`;
 await test('authentication, self-chat and unknown peers rejected',async()=>{await assert.rejects(call(null,'chatOpen',{uid:b.uid}),{code:'UNAUTHENTICATED'});await assert.rejects(call(a,'chatOpen',{uid:a.uid}),{code:'INVALID_ARGUMENT'});await assert.rejects(call(a,'chatOpen',{uid:'missing'}),{code:'NOT_FOUND'});});
 await test('one canonical room for both directions and public profiles only',async()=>{id=(await call(a,'chatOpen',{uid:b.uid})).conversationId;const reverse=await call(b,'chatOpen',{uid:a.uid});assert.equal(reverse.conversationId,id);const room=await read(base());assert.deepEqual(room.members,[a.uid,b.uid].sort());assert.equal(room.profiles[b.uid].display_name,'Bob');assert.equal(JSON.stringify(room).includes('private'),false);});
 await test('participants can read exact room and member-filtered ordered inbox',async()=>{await assertSucceeds(getDoc(doc(alice,base())));await assertSucceeds(getDoc(doc(bob,base())));const q=query(collection(alice,'conversations'),where('members','array-contains',a.uid),orderBy('updated_at','desc'),limit(50));assert.equal((await assertSucceeds(getDocs(q))).size,1);});
 await test('unrelated users and guests cannot scan or read room, children or private user',async()=>{for(const db of [eve,guest]){await assertFails(getDoc(doc(db,base())));await assertFails(getDocs(collection(db,`${base()}/messages`)));await assertFails(getDocs(collection(db,'conversations')));}await assertFails(getDoc(doc(bob,`users/${a.uid}`)));});
 await test('send uses canonical sender and retries do not duplicate',async()=>{await Promise.all([call(a,'chatSend',{conversationId:id,messageId:'one',text:'hello',sender_uid:b.uid}),call(a,'chatSend',{conversationId:id,messageId:'one',text:'hello'})]);const m=await read(`${base()}/messages/one`);assert.equal(m.sender_uid,a.uid);assert.equal(m.text,'hello');assert.equal((await getDocs(collection(alice,`${base()}/messages`))).size,1);await assert.rejects(call(b,'chatSend',{conversationId:id,messageId:'one',text:'hello'}),{code:'ALREADY_EXISTS'});await assert.rejects(call(a,'chatSend',{conversationId:id,messageId:'one',text:'changed'}),{code:'ALREADY_EXISTS'});});
 await test('read receipts match displayed latest message and cannot mark a newer arrival',async()=>{await call(b,'chatRead',{conversationId:id,messageId:'old'});assert.equal((await read(base())).read_at[b.uid],undefined);await call(b,'chatRead',{conversationId:id,messageId:'one'});let room=await read(base());assert.equal(room.read_at[b.uid].toMillis(),room.last_sent_at.toMillis());});
 await test('nonparticipant mutations and malformed bodies are rejected',async()=>{for(const action of ['chatSend','chatRead','chatBlock'])await assert.rejects(call(c,action,{conversationId:id,messageId:'evil',text:'evil',blocked:true}),{code:'PERMISSION_DENIED'});for(const text of ['', ' '.repeat(4),'x'.repeat(2001),123])await assert.rejects(call(a,'chatSend',{conversationId:id,messageId:'invalid',text}),{code:'INVALID_ARGUMENT'});});
 await test('direct client creates, edits, deletes and receipt or membership forgery denied',async()=>{await assertFails(setDoc(doc(alice,'conversations/forged'),{members:[a.uid,c.uid]}));for(const patch of [{members:[a.uid,c.uid]},{read_at:{[b.uid]:Timestamp.now()}},{blocked_by:[]},{last_text:'forged'},{extra:true}])await assertFails(updateDoc(doc(alice,base()),patch));await assertFails(setDoc(doc(alice,`${base()}/messages/fake`),{sender_uid:a.uid,text:'fake',created_at:Timestamp.now()}));await assertFails(updateDoc(doc(alice,`${base()}/messages/one`),{text:'tampered'}));await assertFails(deleteDoc(doc(alice,`${base()}/messages/one`)));await assertFails(deleteDoc(doc(alice,base())));});
 await test('block applies to both senders, re-opening cannot bypass and only self can unblock',async()=>{await call(b,'chatBlock',{conversationId:id,blocked:true});await call(a,'chatOpen',{uid:b.uid});await call(a,'chatBlock',{conversationId:id,blocked:false});for(const user of [a,b])await assert.rejects(call(user,'chatSend',{conversationId:id,messageId:'blocked',text:'blocked'}),{code:'PERMISSION_DENIED'});assert.deepEqual((await read(base())).blocked_by,[b.uid]);await call(b,'chatBlock',{conversationId:id,blocked:false});});
 await test('recipient reply, latest preview and concurrent read race stay consistent',async()=>{await admin(db=>updateDoc(doc(db,base()),{last_sent_at:Timestamp.fromMillis(Date.now()-1000)}));await call(b,'chatSend',{conversationId:id,messageId:'two',text:'안녕!'});await call(b,'chatRead',{conversationId:id,messageId:'one'});const room=await read(base());assert.equal(room.last_sender_uid,b.uid);assert.equal(room.last_text,'안녕!');assert.equal(room.last_message_id,'two');assert.ok(room.last_sent_at.toMillis()>room.read_at[a.uid].toMillis());await call(a,'chatRead',{conversationId:id,messageId:'two'});assert.equal((await read(base())).read_at[a.uid].toMillis(),room.last_sent_at.toMillis());});
 await test('rate limit rejects rapid different messages, same-id retry remains safe',async()=>{await admin(db=>updateDoc(doc(db,base()),{last_sent_at:Timestamp.fromMillis(Date.now()+10000)}));await assert.rejects(call(b,'chatSend',{conversationId:id,messageId:'rapid',text:'rapid'}),{code:'RESOURCE_EXHAUSTED'});await call(b,'chatSend',{conversationId:id,messageId:'two',text:'안녕!'});});
 await test('ordered real message pagination and missing-parent access',async()=>{await admin(async db=>{for(let i=0;i<55;i++)await setDoc(doc(db,`${base()}/messages/history-${i}`),{sender_uid:a.uid,text:`history ${i}`,created_at:Timestamp.fromMillis(1000+i)});});const q=query(collection(bob,`${base()}/messages`),orderBy('created_at','desc'),limit(50));const first=await assertSucceeds(getDocs(q));const rest=await assertSucceeds(getDocs(query(collection(bob,`${base()}/messages`),orderBy('created_at','desc'),startAfter(first.docs.at(-1)),limit(50))));assert.equal(first.size+rest.size,57);await assertFails(getDocs(collection(alice,'conversations/missing/messages')));});
 let groupId;
 const groupInput = { uids: [b.uid, c.uid], name: ' 아침 러닝 ', requestId: 'create-group' };
 const groupPath = () => `group_conversations/${groupId}`;
 await test('group creation validates membership, respects blocks, and is safe to retry', async () => {
  for (const uids of [[b.uid], [b.uid, b.uid], [a.uid, b.uid], Array(10).fill(b.uid)]) {
   await assert.rejects(call(a, 'chatCreateGroup', { ...groupInput, uids }), { code: 'INVALID_ARGUMENT' });
  }
  await assert.rejects(call(a, 'chatCreateGroup', { ...groupInput, uids: [b.uid, 'missing'] }), { code: 'NOT_FOUND' });
  await call(b, 'blockUser', { uid: c.uid, blocked: true });
  await assert.rejects(call(a, 'chatCreateGroup', groupInput), { code: 'PERMISSION_DENIED' });
  await call(b, 'blockUser', { uid: c.uid, blocked: false });
  const results = await Promise.all([call(a, 'chatCreateGroup', groupInput), call(a, 'chatCreateGroup', groupInput)]);
  groupId = results[0].conversationId;
  assert.equal(results[1].conversationId, groupId);
  const group = await read(groupPath());
  assert.equal(group.kind, 'group');
  assert.equal(group.name, '아침 러닝');
  assert.deepEqual(group.members, [a.uid, b.uid, c.uid].sort());
  assert.deepEqual(Object.keys(group.profiles[b.uid]).sort(), ['display_name', 'profile_image']);
  const inbox = collectionName => query(collection(bob, collectionName), where('members', 'array-contains', b.uid), orderBy('updated_at', 'desc'), limit(50));
  assert.equal((await assertSucceeds(getDocs(inbox('group_conversations')))).docs[0].id, groupId);
  assert.deepEqual((await assertSucceeds(getDocs(inbox('conversations')))).docs.map(item => item.id), [id]);
 });
 await test('room notification settings are per member and group names are shared', async () => {
  await assert.rejects(call(c, 'chatMute', { conversationId: id, muted: true }), { code: 'PERMISSION_DENIED' });
  await assert.rejects(call(a, 'chatMute', { conversationId: id, muted: 'yes' }), { code: 'INVALID_ARGUMENT' });
  await call(a, 'chatMute', { conversationId: id, muted: true, uid: b.uid });
  assert.deepEqual((await read(base())).muted_by, [a.uid]);
  await call(b, 'chatMute', { conversationId: id, muted: false });
  assert.deepEqual((await read(base())).muted_by, [a.uid]);
  await call(a, 'chatMute', { conversationId: groupId, muted: true });
  await call(a, 'chatMute', { conversationId: id, muted: false });
  assert.deepEqual((await read(base())).muted_by, []);
  assert.deepEqual((await read(groupPath())).muted_by, [a.uid]);
  await assert.rejects(call(a, 'chatRename', { conversationId: id, name: '저녁 러닝' }), { code: 'INVALID_ARGUMENT' });
  await assert.rejects(call(b, 'chatRename', { conversationId: groupId, name: ' '.repeat(2) }), { code: 'INVALID_ARGUMENT' });
  await assert.rejects(call(b, 'chatRename', { conversationId: groupId, name: '가'.repeat(41) }), { code: 'INVALID_ARGUMENT' });
  const updatedAt = (await read(groupPath())).updated_at.toMillis();
  await call(b, 'chatRename', { conversationId: groupId, name: ' 저녁 러닝 ' });
  const renamed = await read(groupPath());
  assert.equal(renamed.name, '저녁 러닝');
  assert.equal(renamed.updated_at.toMillis(), updatedAt);
  await assertFails(updateDoc(doc(bob, groupPath()), { name: 'forged', muted_by: [a.uid] }));
 });
 await test('only group members can read, send and mark the latest message read', async () => {
  const outsider = await signup();
  await admin(db => setDoc(doc(db, `users/${outsider.uid}`), { display_name: 'Outsider' }));
  const stranger = env.authenticatedContext(outsider.uid).firestore();
  await assertSucceeds(getDoc(doc(eve, groupPath())));
  await assertFails(getDoc(doc(stranger, groupPath())));
  await assertFails(getDocs(collection(guest, 'group_conversations')));
  await assertFails(getDocs(collection(bob, 'group_conversations')));
  await assertFails(setDoc(doc(eve, 'group_conversations/forged'), { members: [c.uid, outsider.uid] }));
  await assertFails(getDocs(collection(stranger, `${groupPath()}/messages`)));
  await assertFails(updateDoc(doc(eve, groupPath()), { members: [c.uid, outsider.uid] }));
  for (const action of ['chatSend', 'chatRead', 'chatLeave', 'chatMute', 'chatRename']) {
   await assert.rejects(call(outsider, action, { conversationId: groupId, messageId: 'first', text: 'test', muted: true, name: 'test' }), { code: 'PERMISSION_DENIED' });
  }
  await assert.rejects(call(a, 'chatBlock', { conversationId: groupId, blocked: true }), { code: 'INVALID_ARGUMENT' });
  await call(b, 'chatSend', { conversationId: groupId, messageId: 'first', text: '안녕하세요' });
  await call(c, 'chatSend', { conversationId: groupId, messageId: 'reply', text: '반가워요' });
  await call(a, 'chatRead', { conversationId: groupId, messageId: 'reply' });
  assert.equal((await read(`${groupPath()}/messages/reply`)).sender_uid, c.uid);
  const group = await read(groupPath());
  assert.equal(group.read_at[a.uid].toMillis(), group.last_sent_at.toMillis());
 });
 await test('blocking cannot be bypassed through an existing group, and leaving revokes access', async () => {
  const direct = (await call(b, 'chatOpen', { uid: c.uid })).conversationId;
  await call(b, 'blockUser', { uid: c.uid, blocked: true });
  await assert.rejects(call(b, 'chatBlock', { conversationId: direct, blocked: false }), { code: 'FAILED_PRECONDITION' });
  await call(b, 'blockUser', { uid: c.uid, blocked: false });
  await call(b, 'chatBlock', { conversationId: direct, blocked: true });
  await assert.rejects(call(b, 'chatSend', { conversationId: groupId, messageId: 'blocked-group', text: 'test' }), { code: 'PERMISSION_DENIED' });
  await call(b, 'chatBlock', { conversationId: direct, blocked: false });
  await assert.rejects(call(a, 'chatLeave', { conversationId: id }), { code: 'PERMISSION_DENIED' });
  await call(c, 'chatMute', { conversationId: groupId, muted: true });
  await call(c, 'chatLeave', { conversationId: groupId });
  await call(c, 'chatLeave', { conversationId: groupId });
  await assertFails(getDoc(doc(eve, groupPath())));
  await assertFails(getDoc(doc(eve, `${groupPath()}/messages/reply`)));
  await assert.rejects(call(c, 'chatSend', { conversationId: groupId, messageId: 'after-leave', text: 'test' }), { code: 'PERMISSION_DENIED' });
  await assertSucceeds(getDoc(doc(alice, `${groupPath()}/messages/reply`)));
  const group = await read(groupPath());
  assert.deepEqual(group.members, [a.uid, b.uid].sort());
  assert.equal(group.read_at[c.uid], undefined);
  assert.deepEqual(group.muted_by, [a.uid]);
  assert.equal(group.profiles[c.uid].display_name, 'Eve');
 });
 await test('new messages notify eligible recipients once, even if push delivery fails', async () => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  const { createRequire } = require('node:module');
  const fromFunctions = createRequire(require.resolve('../functions/package.json'));
  const { initializeApp, deleteApp } = fromFunctions('firebase-admin/app');
  const { getMessaging } = fromFunctions('firebase-admin/messaging');
  const { chatAction } = require('../functions/lib/chat');
  const app = initializeApp({ projectId: project });
  const messaging = getMessaging(app);
  const originalSend = messaging.sendEachForMulticast;
  const pushes = [];
  messaging.sendEachForMulticast = async payload => {
   pushes.push(payload);
   throw Object.assign(new Error('mock delivery failure'), { code: 'messaging/unavailable' });
  };
  try {
   const d = await signup();
   await admin(async db => {
    await setDoc(doc(db, `users/${d.uid}`), { display_name: 'D', fcm_token: 'fixture-d', notification_settings: { push: false } });
    for (const [user, token] of [[a, 'fixture-a'], [b, 'fixture-b'], [c, 'fixture-c']]) {
     await updateDoc(doc(db, `users/${user.uid}`), { fcm_token: token, notification_settings: { push: true } });
    }
   });
   const { conversationId } = await call(a, 'chatCreateGroup', { uids: [b.uid, c.uid, d.uid], name: '달리기 모임', requestId: 'push-test' });
   await call(c, 'chatMute', { conversationId, muted: true });
   const send = { action: 'chatSend', conversationId, messageId: 'push-one', text: '같이 달려요' };
   assert.deepEqual(await chatAction(a.uid, send, 'Alice'), { messageId: 'push-one' });
   await chatAction(a.uid, send, 'Alice');
   assert.equal(pushes.length, 1);
   assert.deepEqual(pushes[0].tokens, ['fixture-b']);
   assert.equal(pushes[0].notification.title, '달리기 모임');
   assert.deepEqual(pushes[0].data, { type: 'chat', target_id: conversationId });
   assert.equal((await read(`group_conversations/${conversationId}/messages/push-one`)).text, send.text);
  } finally {
   messaging.sendEachForMulticast = originalSend;
   await deleteApp(app);
  }
 });
 console.log(`${passed} chat integration and security scenarios passed`);
}finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
