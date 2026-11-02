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
    await test('profile exposes pet and brief runs without locations or private account fields', async () => {
      await env.withSecurityRulesDisabled(async ctx => {
        await updateDoc(doc(ctx.firestore(),`users/${a.uid}/character/${a.uid}`),{stage:'child',exp:100,private_note:'not-public'});
        await setDoc(doc(ctx.firestore(),'runs/profile-summary-run'),{uid:a.uid,started_at:Timestamp.now(),distance_km:3,duration_sec:1200,avg_pace_sec:400,route:[{lat:37.5,lng:127}],private_note:'not-public'});
      });
      const response=await call(b,'profile',{uid:a.uid});
      assert.equal(response.pet.character_type,'rabbit');assert.equal(response.pet.stage,'child');
      assert.equal(response.run_count,1);assert.equal(response.recent_runs[0].distance_km,3);
      const json=JSON.stringify(response);assert.ok(!json.includes('not-public'));assert.ok(!json.includes('route'));assert.ok(!json.includes('lat'));assert.ok(!json.includes('private@example'));
    });
    await test('connections paginate real follows and return only public users', async () => {
      await env.withSecurityRulesDisabled(async ctx => {
        const db=ctx.firestore();
        await Promise.all(Array.from({length:32},async (_,i)=>{
          const peer=`list-peer-${String(i).padStart(2,'0')}`;
          await setDoc(doc(db,`users/${peer}`),{display_name:peer,total_km:i,email:'not-public@example.test',phone:'not-public',fcm_token:'not-public',following_count:0,follower_count:1});
          await setDoc(doc(db,`follows/${c.uid}_${peer}`),{follower_id:c.uid,following_id:peer,created_at:Timestamp.now()});
        }));
      });
      const first=await call(b,'connections',{uid:c.uid,kind:'following'});
      assert.equal(first.users.length,30);assert.ok(first.cursor);
      const second=await call(b,'connections',{uid:c.uid,kind:'following',cursor:first.cursor});
      assert.equal(second.users.length,2);assert.equal(second.cursor,null);
      assert.equal(new Set([...first.users,...second.users].map(p=>p.uid)).size,32);
      assert.ok(!JSON.stringify(first).includes('not-public'));
      const followers=await call(b,'connections',{uid:'list-peer-00',kind:'followers'});
      assert.equal(followers.users[0].uid,c.uid);
      await assert.rejects(call(b,'connections',{uid:c.uid,kind:'unknown'}));
      await assert.rejects(call(b,'connections',{uid:c.uid,kind:'following',cursor:'../../users'}));
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

    const parkCall=(u,action,data={})=>call(u,action,data,'parkAction');
    await env.withSecurityRulesDisabled(async ctx=>{
      const db=ctx.firestore();
      await setDoc(doc(db,'parks/qa-park'),{park_id:'qa-park',name:'Local QA park',lat:37.55,lng:126.95,address:''});
      await setDoc(doc(db,'parks/other-park'),{park_id:'other-park',name:'Other QA park',lat:38,lng:127,address:''});
      await setDoc(doc(db,'parks/qa-park/courses/three'),{name:'3km QA course',distance_km:3,route:[{lat:37.55,lng:126.95},{lat:37.56,lng:126.96}]});
      await setDoc(doc(db,'parks/other-park/courses/foreign'),{distance_km:5,route:[]});
      await setDoc(doc(db,'park_search_cache/37.55_126.95'),{parks:[{park_id:'qa-park',name:'Local QA park',lat:37.55,lng:126.95,address:''},{park_id:'far',name:'Far park',lat:39,lng:127,address:''}],updated_at:Timestamp.now()});
    });
    await test('nearby cache filters distance, real courses are returned, coordinates are validated',async()=>{
      const response=await parkCall(a,'nearby',{lat:37.55,lng:126.95});
      assert.deepEqual(response.parks.map(p=>p.park_id),['qa-park']);assert.equal(response.stale,false);
      const courses=await parkCall(a,'courses',{parkId:'qa-park'});assert.equal(courses.courses[0].course_id,'three');assert.equal(courses.courses[0].route.length,2);
      await assert.rejects(parkCall(a,'nearby',{lat:'37;out;',lng:126}),{code:'INVALID_ARGUMENT'});
    });
    await test('run references must point to an existing park and its own course',async()=>{
      const client=env.authenticatedContext(a.uid).firestore();
      const make=id=>({run_id:id,uid:a.uid,goal_type:'distance',goal_value:3,started_at:Timestamp.fromMillis(Date.now()-600000),ended_at:serverTimestamp(),created_at:serverTimestamp(),duration_sec:600,distance_km:1,avg_pace_sec:600,avg_speed_kmh:6,calories:60,route:[],exp_earned:0});
      await assert.rejects(setDoc(doc(client,'runs/invalid-park'),{...make('invalid-park'),park_id:'missing'}));
      await assert.rejects(setDoc(doc(client,'runs/wrong-course'),{...make('wrong-course'),park_id:'qa-park',course_id:'foreign'}));
      await assert.rejects(setDoc(doc(client,'runs/orphan-course'),{...make('orphan-course'),course_id:'three'}));
      await setDoc(doc(client,'runs/qa-park-run'),{...make('qa-park-run'),park_id:'qa-park',course_id:'three'});
      await assert.rejects(setDoc(doc(client,'parks/qa-park/weeks/forged/runners/forged'),{distance_km:999}));
    });
    await test('weekly park distance is credited once and suspicious runs are excluded',async()=>{
      const backendRequire=require('node:module').createRequire(require('node:path').resolve(__dirname,'../functions/package.json'));
      const {initializeApp:getAdminApp}=backendRequire('firebase-admin/app');
      const {getFirestore:getAdminDb}=backendRequire('firebase-admin/firestore');
      const admin=getAdminDb(getAdminApp({projectId:project}));
      const {onRunCreate}=require('../functions/lib/onRunCreate');
      const snapshot=await admin.doc('runs/qa-park-run').get();
      await Promise.all([onRunCreate.run({data:snapshot}),onRunCreate.run({data:snapshot})]);
      const ranks=await parkCall(b,'rankings',{parkId:'qa-park'});
      assert.equal(ranks.runners.length,1);assert.equal(ranks.runners[0].distance_km,1);assert.equal(ranks.runners[0].run_count,1);
      const client=env.authenticatedContext(a.uid).firestore();
      const id='qa-fast-run';await setDoc(doc(client,`runs/${id}`),{run_id:id,uid:a.uid,goal_type:'free',goal_value:null,started_at:Timestamp.fromMillis(Date.now()-600000),ended_at:serverTimestamp(),created_at:serverTimestamp(),duration_sec:600,distance_km:10,avg_pace_sec:60,avg_speed_kmh:60,calories:600,route:[],exp_earned:0,park_id:'qa-park'});
      await onRunCreate.run({data:await admin.doc(`runs/${id}`).get()});
      assert.equal((await parkCall(b,'rankings',{parkId:'qa-park'})).runners[0].distance_km,1);
      assert.equal((await read(`runs/${id}`)).flagged,true);
      await assert.rejects(getDoc(doc(env.authenticatedContext(b.uid).firestore(),'runs/qa-park-run')));
    });

    const items=(u,action,data={})=>call(u,action,data,'inventoryAction');
    await test('starter grants retry once, ownership and equipment stay private and server-owned',async()=>{
      const results=await Promise.all([items(b,'list'),items(b,'list')]);
      assert.deepEqual(results[0].owned.sort(),['gold-stars','mint-glow']);
      assert.equal(results[0].totalKm,0);
      const acquired=(await read(`users/${b.uid}/inventory/mint-glow`)).acquired_at.toMillis();
      await items(b,'list');
      assert.equal((await read(`users/${b.uid}/inventory/mint-glow`)).acquired_at.toMillis(),acquired);
      await assert.rejects(items(b,'equip',{itemId:'pink-petals',totalKm:999,uid:a.uid}),{code:'PERMISSION_DENIED'});
      await assert.rejects(items(b,'equip',{itemId:'../gold-stars'}),{code:'INVALID_ARGUMENT'});
      await assert.rejects(items(b,'unequip',{slot:'__proto__'}),{code:'INVALID_ARGUMENT'});
      const client=env.authenticatedContext(b.uid).firestore();
      await assert.rejects(setDoc(doc(client,`users/${b.uid}/inventory/pink-petals`),{item_id:'pink-petals'}));
      await assert.rejects(updateDoc(doc(client,`users/${b.uid}/character/${b.uid}`),{equipped:{accessory:'pink-petals'}}));
      await assert.rejects(getDoc(doc(env.authenticatedContext(c.uid).firestore(),`users/${b.uid}/inventory/mint-glow`)));
    });
    await test('equipping derives the correct slot, preserves other slots, and survives a fresh read',async()=>{
      await Promise.all([items(b,'equip',{itemId:'gold-stars',slot:'top'}),items(b,'equip',{itemId:'mint-glow'})]);
      assert.deepEqual((await items(b,'list')).equipped,{back:'mint-glow',accessory:'gold-stars'});
      await items(b,'equip',{itemId:'gold-stars'});
      const unlinked=await items(b,'unequip',{slot:'accessory'});
      assert.deepEqual(unlinked.equipped,{back:'mint-glow'});
      assert.deepEqual((await read(`users/${b.uid}/character/${b.uid}`)).equipped,{back:'mint-glow'});
      assert.equal((await read(`users/${b.uid}/character/${b.uid}`)).exp,0);
    });
    await test('distance unlocks use authoritative mileage and replace only the matching slot',async()=>{
      await env.withSecurityRulesDisabled(async ctx=>{await updateDoc(doc(ctx.firestore(),`users/${b.uid}`),{total_km:5});});
      const state=await items(b,'list');assert.ok(state.owned.includes('peach-glow'));assert.ok(!state.owned.includes('pink-petals'));
      await items(b,'equip',{itemId:'peach-glow'});assert.equal((await items(b,'list')).equipped.back,'peach-glow');
      await assert.rejects(items(b,'equip',{itemId:'pink-petals'}),{code:'PERMISSION_DENIED'});
      await env.withSecurityRulesDisabled(async ctx=>{await updateDoc(doc(ctx.firestore(),`users/${b.uid}`),{total_km:10});});
      await items(b,'equip',{itemId:'pink-petals'});
      assert.deepEqual((await items(b,'list')).equipped,{back:'peach-glow',accessory:'pink-petals'});
    });

    await test('user id: saving claims it, a taken id is refused, and changing it frees the old one',async()=>{
      const save=(user,displayName,userId)=>call(user,null,{displayName,petName:'달료',website:'',heightCm:null,weightKg:null,gender:null,region:'경기',dialect:'std',notifications:prefs,profileImage:null,userId},'saveAccountSettings');
      await save(a,'Alice','@Alice_Run');
      assert.equal((await read(`users/${a.uid}`)).user_id,'alice_run');
      assert.equal((await read('handles/alice_run')).uid,a.uid);
      await assert.rejects(save(b,'Bob','alice_run'),{code:'ALREADY_EXISTS',message:/이미 사용 중/});
      assert.equal((await read(`users/${b.uid}`)).user_id,undefined);
      // 저장이 거절되면 닉네임 같은 다른 항목도 바뀌지 않는다
      await assert.rejects(save(b,'바뀌면안됨','alice_run'),{code:'ALREADY_EXISTS'});
      assert.equal((await read(`users/${b.uid}`)).display_name,'Bob');
      await save(a,'Alice','alice_run');
      assert.equal((await read('handles/alice_run')).uid,a.uid);
      await save(a,'Alice','alice_two');
      assert.equal(await read('handles/alice_run'),undefined);
      assert.equal((await read('handles/alice_two')).uid,a.uid);
      await save(b,'Bob','alice_run');
      assert.equal((await read('handles/alice_run')).uid,b.uid);
      // 빈 칸은 "바꾸지 않음"이고, 형식이 틀리면 거절한다
      await save(a,'Alice','');
      assert.equal((await read(`users/${a.uid}`)).user_id,'alice_two');
      await assert.rejects(save(a,'Alice','no spaces'),{code:'INVALID_ARGUMENT'});
    });
    await test('user id: profiles show it and search finds it with @',async()=>{
      assert.equal((await call(c,'profile',{uid:a.uid})).profile.user_id,'alice_two');
      assert.equal((await call(c,'profile',{uid:c.uid})).profile.user_id,null);
      const found=await call(c,'search',{query:'@Alice_T'});
      assert.deepEqual(found.users.map(u=>u.uid),[a.uid]);
      assert.equal(found.users[0].user_id,'alice_two');
      assert.ok((await call(c,'search',{query:'Alice'})).users.some(u=>u.uid===a.uid));
      assert.deepEqual((await call(c,'search',{query:'@nobody_here'})).users,[]);
    });
    await test('feed is who I follow plus some recommendations, explore is only who I do not follow',async()=>{
      const me=await signup(),friend=await signup(),stranger=await signup();
      await env.withSecurityRulesDisabled(async ctx=>{
        for(const user of [me,friend,stranger]){
          await setDoc(doc(ctx.firestore(),`users/${user.uid}`),{uid:user.uid,display_name:'Feed',pet_name:'달료',profile_image:null,region:'경기',dialect:'std',total_km:0,total_exp:0,follower_count:0,following_count:0,influencer_tier:'none',is_frozen:false,notification_settings:prefs,created_at:Timestamp.now(),updated_at:Timestamp.now()});
        }
      });
      const all=async(user,action,seed=7)=>{
        const ids=[];let offset=0;
        for(;;){const page=await call(user,action,{offset,seed});ids.push(...page.posts.map(p=>p.post_id));offset+=page.posts.length;if(!page.hasMore)break;}
        return ids;
      };
      await call(me,'follow',{uid:friend.uid,following:true});
      await call(me,'createPost',{postId:'feed-mine',text:'mine',visibility:'public'});
      await call(me,'createPost',{postId:'feed-mine-private',text:'mine',visibility:'private'});
      for(const visibility of ['public','followers','private'])await call(friend,'createPost',{postId:`feed-friend-${visibility}`,text:'friend',visibility});
      for(const visibility of ['public','followers','private'])await call(stranger,'createPost',{postId:`feed-stranger-${visibility}`,text:'stranger',visibility});
      await call(stranger,'createPost',{postId:'feed-stranger-gone',text:'gone',visibility:'public'});
      await call(stranger,'deletePost',{postId:'feed-stranger-gone'});
      const home=await all(me,'homeFeed');
      for(const id of ['feed-mine','feed-friend-public','feed-friend-followers','feed-stranger-public'])assert.ok(home.includes(id),`home should have ${id}`);
      for(const id of ['feed-mine-private','feed-friend-private','feed-stranger-followers','feed-stranger-private','feed-stranger-gone'])assert.ok(!home.includes(id),`home should not have ${id}`);
      assert.equal(new Set(home).size,home.length);
      // 내가 올린 글과 팔로우한 사람의 글이 추천 글보다 먼저 나온다
      assert.ok(home.indexOf('feed-friend-public')<home.indexOf('feed-stranger-public'));
      const explore=await all(me,'exploreFeed');
      assert.ok(explore.includes('feed-stranger-public'));
      for(const id of explore)assert.ok(!/^feed-(mine|friend)/.test(id),`explore should not have ${id}`);
      for(const id of ['feed-stranger-followers','feed-stranger-private','feed-stranger-gone'])assert.ok(!explore.includes(id));
      assert.deepEqual(await all(me,'exploreFeed'),explore);
      // 팔로우하면 탐색에서 빠지고, 그 사람의 팔로워 공개 글이 피드에 들어온다
      await call(me,'follow',{uid:stranger.uid,following:true});
      assert.ok(!(await all(me,'exploreFeed')).includes('feed-stranger-public'));
      assert.ok((await all(me,'homeFeed')).includes('feed-stranger-followers'));
      await call(me,'follow',{uid:stranger.uid,following:false});
      assert.ok((await all(me,'exploreFeed')).includes('feed-stranger-public'));
      // 아직 아무도 팔로우하지 않고 글도 없는 사람의 피드는 비지 않고 추천 글로 채워진다
      const newcomer=await signup();
      await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),`users/${newcomer.uid}`),{uid:newcomer.uid,display_name:'New',pet_name:'달료',region:'경기',dialect:'std',total_km:0,total_exp:0,follower_count:0,following_count:0,influencer_tier:'none',is_frozen:false,created_at:Timestamp.now(),updated_at:Timestamp.now()});});
      assert.ok((await all(newcomer,'homeFeed')).includes('feed-stranger-public'));
    });

    await test('search puts people I follow first, then people who follow me, then strangers',async()=>{
      const me=await signup(),stranger=await signup(),fan=await signup(),friend=await signup(),mutual=await signup();
      const names=[[stranger,'Zq가'],[fan,'Zq나'],[friend,'Zq다'],[mutual,'Zq라'],[me,'Zq마']];
      await env.withSecurityRulesDisabled(async ctx=>{
        for(const [user,name] of names)await setDoc(doc(ctx.firestore(),`users/${user.uid}`),{uid:user.uid,display_name:name,pet_name:'달료',profile_image:null,region:'경기',dialect:'std',total_km:0,total_exp:0,follower_count:0,following_count:0,influencer_tier:'none',is_frozen:false,notification_settings:prefs,created_at:Timestamp.now(),updated_at:Timestamp.now()});
      });
      await call(me,'follow',{uid:friend.uid,following:true});
      await call(me,'follow',{uid:mutual.uid,following:true});
      await call(fan,'follow',{uid:me.uid,following:true});
      await call(mutual,'follow',{uid:me.uid,following:true});
      const found=(await call(me,'search',{query:'Zq'})).users;
      const byName=Object.fromEntries(found.map(u=>[u.display_name,u.relation]));
      assert.equal(byName['Zq다'],'following');
      assert.equal(byName['Zq라'],'following');
      assert.equal(byName['Zq나'],'follower');
      assert.equal(byName['Zq가'],'none');
      // 이름순(가나다라)이 아니라 관계 순서: 팔로잉(다, 라) > 나를 팔로우(나) > 모르는 사람(가)
      assert.deepEqual(found.filter(u=>u.uid!==me.uid).map(u=>u.display_name),['Zq다','Zq라','Zq나','Zq가']);
      // 랭킹 등 다른 목록은 관계 정보를 붙이지 않는다
      assert.equal((await call(me,'rankings')).users.every(u=>u.relation===undefined),true);
    });

    console.log(`${passed} backend integration scenarios passed`);
  } finally {await env.cleanup();}
})().catch(error=>{console.error(error);process.exitCode=1;});



