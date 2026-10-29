import React from 'react';
import Renderer, {act} from 'react-test-renderer';
import {useRunRecovery} from '../src/hooks/useRunRecovery';
const mockRead=jest.fn(),mockPending=jest.fn(),mockUpload=jest.fn(),mockCommand=jest.fn();
jest.mock('../src/services/runJournal.service',()=>({readActiveRun:(...args:unknown[])=>mockRead(...args),commandRun:(...args:unknown[])=>mockCommand(...args)}));
jest.mock('../src/services/runOutbox.service',()=>({pendingRuns:(...args:unknown[])=>mockPending(...args),uploadPendingRun:(...args:unknown[])=>mockUpload(...args)}));
let latest:ReturnType<typeof useRunRecovery>,tree:Renderer.ReactTestRenderer;
function Probe({uid}:{uid:string}) {latest=useRunRecovery(uid);return null;}
const snapshot={phase:'paused',startedAtMs:100,context:{uid:'owner'}};
beforeEach(()=>{jest.clearAllMocks();mockRead.mockResolvedValue(null);mockPending.mockResolvedValue([]);mockCommand.mockResolvedValue(null);mockUpload.mockResolvedValue({});});
afterEach(async()=>{await act(()=>tree?.unmount());});
async function render(uid='owner') {await act(async()=>{tree=Renderer.create(<Probe uid={uid}/>);});}
test('unreadable local data reports an error instead of pretending no recovery exists',async()=>{
 mockRead.mockRejectedValue(new Error('corrupt disk'));await render();expect(latest.status).toBe('error');expect(mockCommand).not.toHaveBeenCalled();
});
test('a finished checkpoint already copied into the durable outbox is reconciled without duplicate recovery',async()=>{
 mockRead.mockResolvedValue({...snapshot,phase:'finished'});mockPending.mockResolvedValue([{id:'owner_100'}]);mockUpload.mockRejectedValue(new Error('offline'));
 await render();expect(mockCommand).toHaveBeenCalledWith(expect.objectContaining({startedAtMs:100}),'clear');expect(latest.active).toBeNull();expect(latest.pending).toBe(1);expect(latest.status).toBe('ready');
});
test('an old account response cannot replace the new account recovery screen',async()=>{
 let old!: (value:unknown)=>void;const delayed=new Promise(resolve=>{old=resolve;});
 mockRead.mockImplementation((uid:string)=>uid==='owner'?delayed:Promise.resolve({...snapshot,context:{uid}}));
 await render();await act(async()=>{tree.update(<Probe uid="new-owner"/>);});
 await act(async()=>{old(snapshot);});expect(latest.active?.context.uid).toBe('new-owner');
});
