import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseSnapshot,buildRadar,boardIssue} from './lib/model.ts';
const s=parseSnapshot(readFileSync(process.argv[2]||'/input/snapshot.json','utf8'));
const M=(globalThis as any).RadarModel;
const built=buildRadar(s);
assert.equal(boardIssue(built.board,s),null);
assert.equal(built.board.length,s.protocols.length);
assert.equal(built.board.filter(r=>r.watchlist).length,s.watchlist.length);
// Hand-computed cases exercise units, missingness, date edge cases and clamps.
const p={tvl_usd:1000000,change_7d:20,listed_at:'2023-11-15'};
assert.equal(M.evaluate(p,'2026-11-14').implied_value_usd,300000);
assert.equal(M.evaluate({...p,change_7d:500},'2026-11-14').implied_value_usd,500000);
assert.equal(M.evaluate({...p,change_7d:-90},'2026-11-14').implied_value_usd,125000);
assert.equal(M.evaluate({...p,change_7d:null,listed_at:null},'2026-11-14').implied_value_usd,125000);
assert.equal(M.evaluate({...p,listed_at:'2027-01-01'},'2026-11-14').age_days,null);
assert.equal(M.evaluate({...p,listed_at:'bad-date'},'2026-11-14').age_days,null);
assert.equal(M.evaluate({...p,listed_at:'2026-11-14'},'2026-11-14').age_days,0);
assert.equal(M.classify({slug:'x',name:'Unknown',category:'Lending'},[]),'Candidate');
assert.equal(M.classify({slug:'x',name:'Unknown',category:'Lending',symbol:'XYZ'},[]),'Recorded token');
assert.equal(M.classify({slug:'x',name:'Wrapped Asset',category:'Lending'},[]),'Review / derivative');
for(const r of built.board){assert.equal(M.evaluate(r,s.as_of).implied_value_usd,r.implied_value_usd);assert.ok(r.farm_steps.every(t=>t.length>=20&&t.length<=600));}
console.log(JSON.stringify({passed:true,rows:built.board.length,watchlist:s.watchlist.length,model_cases:10}));
