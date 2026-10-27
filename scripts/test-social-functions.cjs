const assert = require('node:assert/strict');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp } = require('firebase/firestore');
const project = 'demo-dalryo';
async function signup() {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({returnSecureToken: true}),
  });
  const data = await response.json();
  assert.ok(data.idToken, JSON.stringify(data));
  return {uid: data.localId, token: data.idToken};
}
async function call(user, action, data = {}, name = 'socialAction') {
  const response = await fetch(`http://127.0.0.1:5001/${project}/asia-northeast3/${name}`, {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${user.token}`},
    body: JSON.stringify({data: {action, ...data}}), signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (result.error) throw Object.assign(new Error(result.error.message), {code: result.error.status});
  assert.ok(response.ok, JSON.stringify(result));
  return result.result;
}
(async () => {
  const env = await initializeTestEnvironment({projectId: project});
  let passed = 0;
  const test = async (name, run) => {await run(); passed++;console.log(`PASS ${name}`);};
  const a = await signup(), b = await signup(), c = await signup();
  const prefs = {push:false, social:true, growth:true, stone:true};
  const read = async path => {let data; await env.withSecurityRulesDisabled(async ctx => {data=(await getDoc(doc(ctx.firestore(), path))).data();}); return data;};
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      for (const user of [a,b,c]) {
        await setDoc(doc(ctx.firestore(), `users/${user.uid}`), {uid:user.uid,display_name:user===a?'Alice':'Bob',pet_name:'달료',profile_image:null,region:'경기',dialect:'std',total_km:0,total_exp:0,follower_count:0,following_count:0,influencer_tier:'none',is_frozen:false,email:'private@example.test',phone:'private',notification_settings:prefs,created_at:Timestamp.now(),updated_at:Timestamp.now()});
        await setDoc(doc(ctx.firestore(), `users/${user.uid}/character/${user.uid}`), {uid:user.uid,pet_name:'달료',stage:'egg',character_type:'rabbit',exp:0});
      }
    });
    await test('account save synchronizes both names without granting growth', async () => {
      await call(a,null,{displayName:'Alice',petName:'동동',website:'',heightCm:null,weightKg:null,gender:null,region:'경기',dialect:'std',notifications:prefs,profileImage:null,total_exp:999},'saveAccountSettings');
      assert.equal((await read(`users/${a.uid}`)).pet_name,'동동');
      assert.equal((await read(`users/${a.uid}/character/${a.uid}`)).pet_name,'동동');
      assert.equal((await read(`users/${a.uid}`)).total_exp,0);
    });
    await test('post creation is idempotent and author is canonical', async () => {
      const input={postId:'public-post',text:'hello',visibility:'public',uid:b.uid,author_name:'forged'};
      await call(a,'createPost',input); await call(a,'createPost',input);
      const post=await read('posts/public-post');assert.equal(post.uid,a.uid);assert.equal(post.author_name,'Alice');assert.equal(post.like_count,0);
      await assert.rejects(call(b,'createPost',input), {code:'PERMISSION_DENIED'});
    });
    await test('concurrent desired-like retries change count once', async () => {
      await Promise.all([call(b,'like',{postId:'public-post',active:true}),call(b,'like',{postId:'public-post',active:true})]);
      assert.equal((await read('posts/public-post')).like_count,1);
      await Promise.all([call(b,'like',{postId:'public-post',active:false}),call(b,'like',{postId:'public-post',active:false})]);
      assert.equal((await read('posts/public-post')).like_count,0);
    });
    await test('comments and replies retry safely, deletion decrements once', async () => {
      const input={postId:'public-post',commentId:'comment-one',text:'응원'};
      await call(b,'comment',input);await call(b,'comment',input);
      await assert.rejects(call(a,'comment',input),{code:'PERMISSION_DENIED'});
      await call(a,'comment',{...input,commentId:'reply-one',parentId:'comment-one'});
      assert.equal((await read('posts/public-post')).comment_count,2);
      await call(b,'deleteComment',{postId:'public-post',commentId:'comment-one'});
      await call(b,'deleteComment',{postId:'public-post',commentId:'comment-one'});
      assert.equal((await read('posts/public-post')).comment_count,1);
      assert.equal((await read('posts/public-post/comments/comment-one')).deleted,true);
    });
    await test('private and follower visibility enforce real relationship', async () => {
      await call(a,'createPost',{postId:'private-post',text:'private',visibility:'private'});
      await call(a,'createPost',{postId:'followers-post',text:'friends',visibility:'followers'});
      await assert.rejects(call(b,'post',{postId:'private-post'}));
      await assert.rejects(call(b,'post',{postId:'followers-post'}));
      await call(b,'follow',{uid:a.uid,following:true});await call(b,'follow',{uid:a.uid,following:true});
      assert.equal((await read(`users/${a.uid}`)).follower_count,1);
      assert.equal((await read(`users/${b.uid}`)).following_count,1);
      assert.ok((await call(b,'post',{postId:'followers-post'})).post);
      await assert.rejects(call(b,'post',{postId:'private-post'}));
      const feed=await call(b,'followingFeed');assert.ok(feed.posts.some(p=>p.post_id==='followers-post'));assert.ok(!feed.posts.some(p=>p.post_id==='private-post'));
      await call(b,'follow',{uid:a.uid,following:false});await call(b,'follow',{uid:a.uid,following:false});
      assert.equal((await read(`users/${a.uid}`)).follower_count,0);
    });
    await test('public profile DTO excludes account PII', async () => {
      const response=await call(b,'profile',{uid:a.uid});
      const json=JSON.stringify(response);assert.ok(!json.includes('private@example.test'));assert.ok(!json.includes('phone'));assert.ok(!json.includes('notification_settings'));
    });
    await test('own bookmarks can be removed after visibility is revoked', async () => {
      await call(b,'bookmark',{postId:'public-post',active:true});
      await call(a,'editPost',{postId:'public-post',text:'hidden',visibility:'private'});
      await assert.rejects(call(b,'post',{postId:'public-post'}));
      await call(b,'bookmark',{postId:'public-post',active:false});
      assert.equal(await read(`bookmarks/${b.uid}_public-post`),undefined);
      await assert.rejects(call(b,'deletePost',{postId:'public-post'}));
    });
    await test('cross-account images and missing reply parents are rejected', async () => {
      await assert.rejects(call(b,'createPost',{postId:'bad-image',text:'photo',visibility:'public',imageUrl:`https://firebasestorage.googleapis.com/v0/b/${project}.firebasestorage.app/o/posts%2F${a.uid}%2Fphoto.jpg?alt=media`}));
      await assert.rejects(call(b,'comment',{postId:'followers-post',commentId:'bad-reply',text:'reply',parentId:'missing'}));
    });
    const roomCall=(u,action,data={})=>call(u,action,data,'roomAction');
    await test('only mutual friends can be asked, and only invited friends can join or read',async()=>{
      await call(a,'follow',{uid:b.uid,following:true});await call(b,'follow',{uid:a.uid,following:true});
      await call(a,'follow',{uid:c.uid,following:true});
      const friends=await roomCall(a,'friends');assert.deepEqual(friends.friends.map(f=>f.uid),[b.uid]);
      const options={roomId:'room-one',title:'Together QA',goalKm:5,inviteUids:[b.uid]};
      await assert.rejects(roomCall(a,'create',{...options,roomId:'room-zero',inviteUids:[c.uid]}),{code:'PERMISSION_DENIED'});
      await roomCall(a,'create',options);await roomCall(a,'create',options);
      const room=await read('together_rooms/room-one');
      assert.equal(room.member_count,1);assert.equal(room.capacity,2);assert.deepEqual(room.invited,[b.uid]);
      assert.equal((await read(`users/${b.uid}/room_invites/room-one`)).host_uid,a.uid);
      assert.equal((await read(`users/${b.uid}/notifications/room_invite_room-one`)).type,'room_invite');
      await assert.rejects(roomCall(a,'create',{...options,roomId:'room-two'}));
      await assert.rejects(roomCall(c,'join',{roomId:'room-one'}),{code:'PERMISSION_DENIED'});
      await assert.rejects(getDoc(doc(env.authenticatedContext(c.uid).firestore(),'together_rooms/room-one')));
      await getDoc(doc(env.authenticatedContext(b.uid).firestore(),'together_rooms/room-one'));
      const inbox=await roomCall(b,'invites');assert.deepEqual(inbox.invites.map(i=>i.room_id),['room-one']);
      await roomCall(b,'join',{roomId:'room-one'});await roomCall(b,'join',{roomId:'room-one'});
      const joined=await read('together_rooms/room-one');assert.equal(joined.member_count,2);assert.deepEqual(joined.invited,[]);
      assert.equal(await read(`users/${b.uid}/room_invites/room-one`),undefined);
    });
    await test('only the host starts and progress cannot impersonate or decrease',async()=>{
      await assert.rejects(roomCall(b,'start',{roomId:'room-one'}),{code:'PERMISSION_DENIED'});
      await roomCall(a,'start',{roomId:'room-one'});await roomCall(a,'start',{roomId:'room-one'});
      const client=env.authenticatedContext(b.uid).firestore();
      const progress={current_km:1,pace_sec:330,state:'active',updated_at:serverTimestamp()};
      await updateDoc(doc(client,`together_rooms/room-one/members/${b.uid}`),progress);
      await assert.rejects(updateDoc(doc(client,`together_rooms/room-one/members/${b.uid}`),{...progress,current_km:0.9}));
      await assert.rejects(updateDoc(doc(client,`together_rooms/room-one/members/${a.uid}`),progress));
      await assert.rejects(updateDoc(doc(client,`together_rooms/room-one/members/${b.uid}`),{...progress,state:'finished'}));
    });
    await test('finish is idempotent, late updates cannot resurrect, host leaving closes the room',async()=>{
      await roomCall(b,'finish',{roomId:'room-one',km:1.2,pace:340});
      await roomCall(b,'finish',{roomId:'room-one',km:1.2,pace:340});
      const client=env.authenticatedContext(b.uid).firestore();
      await assert.rejects(updateDoc(doc(client,`together_rooms/room-one/members/${b.uid}`),{current_km:1.3,pace_sec:300,state:'active',updated_at:serverTimestamp()}));
      await roomCall(a,'leave',{roomId:'room-one'});await roomCall(a,'leave',{roomId:'room-one'});
      const room=await read('together_rooms/room-one');assert.equal(room.host_uid,b.uid);assert.equal(room.status,'finished');assert.equal(room.member_count,1);
      await roomCall(b,'leave',{roomId:'room-one'});
      assert.equal(await read(`users/${b.uid}/room/active`),undefined);
    });
    await test('declining frees the seat, and the host can call more friends before starting',async()=>{
      await call(c,'follow',{uid:a.uid,following:true});
      await roomCall(a,'create',{roomId:'room-three',title:'Again',goalKm:3,inviteUids:[b.uid]});
      await roomCall(b,'decline',{roomId:'room-three'});await roomCall(b,'decline',{roomId:'room-three'});
      let room=await read('together_rooms/room-three');assert.deepEqual(room.invited,[]);assert.equal(room.capacity,1);
      assert.equal(await read(`users/${b.uid}/room_invites/room-three`),undefined);
      await assert.rejects(roomCall(b,'join',{roomId:'room-three'}),{code:'PERMISSION_DENIED'});
      await assert.rejects(roomCall(b,'invite',{roomId:'room-three',inviteUids:[a.uid]}),{code:'PERMISSION_DENIED'});
      await roomCall(a,'invite',{roomId:'room-three',inviteUids:[c.uid]});
      room=await read('together_rooms/room-three');assert.deepEqual(room.invited,[c.uid]);assert.equal(room.capacity,2);
      await roomCall(a,'start',{roomId:'room-three'});
      assert.equal(await read(`users/${c.uid}/room_invites/room-three`),undefined);
      await assert.rejects(roomCall(c,'join',{roomId:'room-three'}),{code:'PERMISSION_DENIED'});
      await roomCall(a,'leave',{roomId:'room-three'});
    });
    console.log(`${passed} backend integration scenarios passed`);
  } finally {await env.cleanup();}
})().catch(error=>{console.error(error);process.exitCode=1;});



