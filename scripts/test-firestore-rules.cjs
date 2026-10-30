const fs = require('fs');
const {initializeTestEnvironment, assertSucceeds, assertFails} = require('@firebase/rules-unit-testing');
const {doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where, orderBy, Timestamp, serverTimestamp, deleteField, setLogLevel} = require('firebase/firestore');
setLogLevel('silent');

(async () => {
  const env = await initializeTestEnvironment({projectId: 'demo-dalryo', firestore: {rules: fs.readFileSync('firestore.rules', 'utf8')}});
  let passed = 0;
  const test = async (name, fn) => {await fn();passed++;console.log(`PASS ${name}`);};
  const user = uid => ({uid, display_name: uid, pet_name: '달료', region: '경기', dialect: 'std', total_km: 0, total_exp: 0, is_frozen: false, follower_count: 0, following_count: 0, influencer_tier: 'none', email: `${uid}@example.test`, created_at: Timestamp.now(), updated_at: Timestamp.now()});
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await Promise.all(['alice','bob'].map(uid => setDoc(doc(db, `users/${uid}`), user(uid))));
      for (const visibility of ['public','followers','private']) {
        await setDoc(doc(db, `posts/${visibility}`), {uid:'bob',visibility,text:'hello',created_at:Timestamp.now(),like_count:0,comment_count:0});
        await setDoc(doc(db, `posts/${visibility}/comments/one`), {uid:'bob',text:'comment'});
      }
      await setDoc(doc(db, 'users/alice/notifications/one'), {type:'level_up',is_read:false,created_at:Timestamp.now()});
      await setDoc(doc(db, 'bookmarks/alice_public'), {uid:'alice',post_id:'public'});
      await setDoc(doc(db, 'together_rooms/room'), {host_uid:'bob',status:'running'});
      await setDoc(doc(db, 'together_rooms/room/members/alice'), {uid:'alice',current_km:1,pace_sec:360,updated_at:Timestamp.now()});
    });
    const alice = env.authenticatedContext('alice').firestore();
    const bob = env.authenticatedContext('bob').firestore();
    const guest = env.unauthenticatedContext().firestore();
    await test('private user document belongs only to its owner', async () => {
      await assertSucceeds(getDoc(doc(alice,'users/alice')));
      await assertFails(getDoc(doc(alice,'users/bob')));
      await assertFails(getDocs(collection(alice,'users')));
    });
    await test('profile validation prevents deleted fields, coercion and forged growth', async () => {
      await assertSucceeds(updateDoc(doc(alice,'users/alice'),{display_name:'새 이름'}));
      for (const value of [{total_km:100},{display_name:deleteField()},{height_cm:'170'},{admin:true},{pet_name:'다른 이름'}]) await assertFails(updateDoc(doc(alice,'users/alice'),value));
    });
    await test('valid egg initialization works and growth cannot be self-awarded', async () => {
      const character = {uid:'alice',stage:'egg',character_type:'rabbit',pet_name:'달료',exp:0,stat_stamina:0,stat_speed:0,stat_endurance:0,last_active_at:serverTimestamp(),created_at:serverTimestamp(),updated_at:serverTimestamp()};
      await assertSucceeds(setDoc(doc(alice,'users/alice/character/alice'),character));
      await assertFails(updateDoc(doc(alice,'users/alice/character/alice'),{exp:100}));
    });
    await test('new account cannot grant itself follower counts or a paid character', async () => {
      const eve = env.authenticatedContext('eve').firestore();
      await assertFails(setDoc(doc(eve,'users/eve'),{...user('eve'),follower_count:9999}));
      await assertSucceeds(setDoc(doc(eve,'users/eve'),user('eve')));
      await assertFails(setDoc(doc(eve,'users/eve/character/eve'),{uid:'eve',stage:'egg',character_type:'goldpig',pet_name:'달료',exp:0,stat_stamina:0,stat_speed:0,stat_endurance:0,last_active_at:serverTimestamp(),created_at:serverTimestamp(),updated_at:serverTimestamp()}));
    });
    await test('starter eggs allow rabbit and duck only; all shop animals are denied', async () => {
      const source = fs.readFileSync('src/types/character.types.tsx', 'utf8').split('] as const;')[0];
      const types = [...source.matchAll(/'([a-z]+)'/g)].map(match => match[1]);
      for (const type of types) {
        const uid = `starter-${type}`;
        const db = env.authenticatedContext(uid).firestore();
        const ref = doc(db, `users/${uid}/character/${uid}`);
        const character = {uid,stage:'egg',character_type:type,pet_name:'달료',exp:0,stat_stamina:0,stat_speed:0,stat_endurance:0,last_active_at:serverTimestamp(),created_at:serverTimestamp(),updated_at:serverTimestamp()};
        await (['rabbit','duck'].includes(type) ? assertSucceeds(setDoc(ref,character)) : assertFails(setDoc(ref,character)));
      }
      await assertFails(updateDoc(doc(alice,'users/alice/character/alice'),{character_type:'penguin'}));
    });
    await test('post visibility requires authentication, authorship or an actual follow', async () => {
      await assertSucceeds(getDoc(doc(alice,'posts/public')));
      await assertFails(getDoc(doc(guest,'posts/public')));
      await assertFails(getDoc(doc(alice,'posts/followers')));
      await assertFails(getDoc(doc(alice,'posts/private')));
      await assertSucceeds(getDoc(doc(bob,'posts/private')));
      await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'follows/alice_bob'),{follower_id:'alice',following_id:'bob'}));
      await assertSucceeds(getDoc(doc(alice,'posts/followers')));
    });
    await test('public feed and author queries work; unrestricted post scans fail', async () => {
      await assertSucceeds(getDocs(query(collection(alice,'posts'),where('visibility','==','public'),orderBy('created_at','desc'))));
      await assertSucceeds(getDocs(query(collection(bob,'posts'),where('uid','==','bob'),orderBy('created_at','desc'))));
      await assertFails(getDocs(collection(alice,'posts')));
    });
    await test('post counters, likes, comments and follows cannot bypass callable authorization', async () => {
      await assertFails(updateDoc(doc(bob,'posts/public'),{like_count:999}));
      await assertFails(setDoc(doc(alice,'posts/public/likes/alice'),{uid:'alice'}));
      await assertFails(setDoc(doc(alice,'posts/public/comments/fake'),{uid:'alice',text:'fake'}));
      await assertFails(setDoc(doc(alice,'follows/alice_bob'),{follower_id:'alice',following_id:'bob'}));
    });
    await test('private post comments are not readable through a child path', async () => {
      await assertSucceeds(getDocs(collection(alice,'posts/public/comments')));
      await assertFails(getDocs(collection(alice,'posts/private/comments')));
    });
    await test('notification read state is boolean-only and server content stays immutable', async () => {
      const ref = doc(alice,'users/alice/notifications/one');
      await assertSucceeds(updateDoc(ref,{is_read:true}));
      await assertFails(updateDoc(ref,{is_read:'yes'}));
      await assertFails(updateDoc(ref,{type:'forged'}));
      await assertFails(getDoc(doc(bob,'users/alice/notifications/one')));
    });
    await test('bookmarks are private and cannot be forged directly', async () => {
      await assertSucceeds(getDocs(query(collection(alice,'bookmarks'),where('uid','==','alice'))));
      await assertFails(getDoc(doc(bob,'bookmarks/alice_public')));
      await assertFails(setDoc(doc(alice,'bookmarks/alice_private'),{uid:'alice',post_id:'private'}));
    });
    await test('run creation validates ownership and server reward boundaries', async () => {
      const run = {run_id:'run1',uid:'alice',goal_type:'free',goal_value:null,started_at:Timestamp.fromMillis(Date.now()-1000),ended_at:serverTimestamp(),duration_sec:360,distance_km:1,avg_pace_sec:360,avg_speed_kmh:10,calories:60,route:[],exp_earned:0,created_at:serverTimestamp()};
      await assertSucceeds(setDoc(doc(alice,'runs/run1'),run));
      await assertFails(setDoc(doc(alice,'runs/run2'),{...run,run_id:'run2',exp_earned:100}));
      await assertFails(setDoc(doc(alice,'runs/run3'),{...run,run_id:'run3',uid:'bob'}));
      await assertFails(deleteDoc(doc(alice,'runs/run1')));
    });
    await test('room progress cannot impersonate a member, rewind distance or change host state', async () => {
      const ref = doc(alice,'together_rooms/room/members/alice');
      await assertSucceeds(updateDoc(ref,{current_km:2,updated_at:serverTimestamp()}));
      await assertFails(updateDoc(ref,{current_km:.5,updated_at:serverTimestamp()}));
      await assertFails(updateDoc(ref,{uid:'bob',updated_at:serverTimestamp()}));
      await assertFails(updateDoc(doc(bob,'together_rooms/room'),{status:'finished'}));
    });
    console.log(`${passed} security rule scenarios passed`);
  } finally {await env.cleanup();}
})().catch(error=>{console.error(error);process.exitCode=1;});
