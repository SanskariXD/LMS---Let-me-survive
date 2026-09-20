export const days=['Monday','Tuesday','Wednesday','Thursday','Friday'];
export const grid=[['A1','F1','D1','TC1','A2','F2','D2','TC2'],['B1','G1','E1','TA1','B2','G2','E2','TA2'],['C1','A1','F1','B1','C2','A2','F2','B2'],['D1','B1','G1','C1','D2','B2','G2','C2'],['E1','C1','A1','TB1','E2','C2','A2','TB2']];
export const times=[[540,590],[595,645],[650,700],[705,755],[795,845],[850,900],[905,955],[960,1010]];
export function overlap(a,b){return a.day===b.day&&a.start<b.end&&b.start<a.end}
export function events(o,chosenLab){const out=[];for(const token of o.theory.split('+').filter(Boolean)){let found=false;grid.forEach((row,day)=>row.forEach((s,i)=>{if(s===token){found=true;out.push({day,start:times[i][0],end:times[i][1],slot:token,type:'Theory'})}}));if(!found)throw Error('Unknown theory slot: '+token)}
const lab=chosenLab??o.lab;if(lab){const ns=[...lab.matchAll(/L(\d+)/g)].map(m=>+m[1]);if(!ns.length||ns.length%2)throw Error('Invalid lab pair: '+lab);for(let i=0;i<ns.length;i+=2){const n=ns[i];if(n<1||n>39||n%2!==1||ns[i+1]!==n+1)throw Error('Invalid lab pair: '+lab);const a=n<=20,local=(n-1)%20,day=Math.floor(local/4),p=local%4===0?0:1;const start=a?(p===0?540:650):(p===0?795:905);out.push({day,start,end:start+100,slot:`L${n}+L${n+1}`,type:'Lab'})}}
return out}
export const facultyKey=o=>(o.theoryFaculty||o.labFaculty||'Faculty not listed').toLowerCase().replace(/[.\s]+/g,'').trim();
export const facultyName=o=>(o.theoryFaculty||o.labFaculty||'Faculty not listed').replace(/^(Mrs|Dr|Mr|Ms)\.?\s*/i,'$1. ').trim();
export function variants(course,pref={}){return course.options.filter(o=>(!pref.faculty||facultyKey(o)===pref.faculty)&&(!pref.optionId||String(o.id)===String(pref.optionId))).flatMap(o=>{const labs=!o.labsRequiredTogether&&pref.labMode==='alternative'&&o.pairs.length>1?o.pairs:[o.lab];return labs.map(l=>({...o,lab:l,courseId:course.id,code:course.code,name:course.name,credits:course.credits,events:events(o,l)})).filter(o=>!o.events.some((e,i)=>o.events.slice(i+1).some(f=>overlap(e,f))))})}
export const credits=plan=>plan.reduce((sum,o)=>sum+Number(o.credits||0),0);
export function comparePlans(a,b,criterion='gaps'){const creditOrder=credits(b)-credits(a);if(creditOrder)return creditOrder;const x=metrics(a),y=metrics(b);return criterion==='days'?x.days-y.days||x.gaps-y.gaps||x.end-y.end:criterion==='early'?x.end-y.end||x.gaps-y.gaps||x.days-y.days:x.gaps-y.gaps||x.days-y.days||x.end-y.end}
export function solve(courses,prefs={},limit=500,criterion='gaps'){
 if(!courses.length)return {results:[],truncated:false,nodes:0,totalFound:0};
 const groups=courses.map(c=>({course:c,options:variants(c,prefs[c.id])})).sort((a,b)=>Number(b.course.credits)-Number(a.course.credits)||a.options.length-b.options.length);
 let results=[],nodes=0,truncated=false,totalFound=0;const seen=new Set();
 const trim=()=>{results.sort((a,b)=>comparePlans(a,b,criterion));results.length=Math.min(limit,results.length)};
 function save(picks){if(!picks.length)return;const key=JSON.stringify(picks.map(o=>[o.courseId,o.row,o.theory,o.lab,o.theoryFaculty,o.labFaculty]));if(seen.has(key))return;seen.add(key);totalFound++;results.push([...picks]);if(results.length>=limit+100)trim()}
 // Seed feasible alternatives so a bounded search always has useful results.
 for(let start=0;start<groups.length;start++){let picks=[],busy=[];for(let k=0;k<groups.length;k++){const g=groups[(start+k)%groups.length];const o=g.options.find(o=>!o.events.some(e=>busy.some(f=>overlap(e,f))));if(o){picks.push(o);busy.push(...o.events)}}save(picks.sort((a,b)=>groups.findIndex(g=>g.course.id===a.courseId)-groups.findIndex(g=>g.course.id===b.courseId)))}
 function dfs(i,picks,busy){if(nodes>=250000){truncated=true;return}nodes++;if(i===groups.length){save(picks);return}for(const o of groups[i].options){if(!o.events.some(e=>busy.some(f=>overlap(e,f))))dfs(i+1,[...picks,o],[...busy,...o.events]);if(truncated)return}dfs(i+1,picks,busy)}
 dfs(0,[],[]);trim();return {results,truncated,nodes,totalFound};
}
export function metrics(plan){const ev=plan.flatMap(o=>o.events);let gaps=0;const used=new Set(ev.map(e=>e.day));for(const d of used){const a=ev.filter(e=>e.day===d).sort((a,b)=>a.start-b.start);for(let i=1;i<a.length;i++){let gap=a[i].start-a[i-1].end;const lunch=Math.max(0,Math.min(a[i].start,795)-Math.max(a[i-1].end,755));gaps+=Math.max(0,gap-lunch)}}return {days:used.size,gaps,end:ev.length?Math.max(...ev.map(e=>e.end)):0,minutes:ev.reduce((n,e)=>n+e.end-e.start,0)}}
