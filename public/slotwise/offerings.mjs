import {events} from './engine.mjs';
// Build planner sections only from recognised, explicit offering slots. Never invent a theory/lab link.
export function catalogueFromOfferings(data, code, previous) {
 const info=data?.course_info;
 if(!info||info.course_code!==code||!Array.isArray(data.offerings)||!data.offerings.length)throw Error('No official offerings for this course and semester.');
 const rows=data.offerings;
 if(rows.some(r=>r.course_code!==code||typeof r.slots_offered!=='string'||typeof r.venue!=='string'||typeof r.faculty_name!=='string'))throw Error('Unrecognised university offering format.');
 const normalize=s=>s.toUpperCase().replace(/\s+/g,'');
 const theory=rows.filter(r=>/^(T?[A-G][12])(\+T?[A-G][12])*$/.test(normalize(r.slots_offered)));
 const labs=rows.filter(r=>/^L\d+\+L\d+$/.test(normalize(r.slots_offered)));
 const project=info.course_type==='PRJ';
 const combined=Number(info.theory)>0&&Number(info.practical)>0;
 let sections;
 if(combined){
  if(theory.length===1&&labs.length===1) sections=[[theory[0],labs[0]]];
  else if(previous?.options?.length){
   sections=previous.options.map(o=>{
    const choose=(list,s,f)=>{const matches=list.filter(r=>normalize(r.slots_offered)===normalize(s));const named=matches.filter(r=>r.faculty_name===f);return matches.length===1?matches[0]:named.length===1?named[0]:null};
    return [choose(theory,o.theory,o.theoryFaculty),choose(labs,o.lab,o.labFaculty)];
   }).filter(pair=>pair.every(Boolean));
  }else throw Error('This combined course needs confirmed theory–lab section links. Its official response cannot safely establish those links yet.');
 }else sections=(project?rows.filter(r=>normalize(r.slots_offered)==='PROJECT'):Number(info.practical)>0?labs:theory).map(r=>Number(info.practical)>0&&!project?[null,r]:[r,null]);
 if(!sections.length)throw Error('No recognised slots. The university response needs a format update.');
 const options=sections.map(([t,l],i)=>{
  const option={id:`official-${code}-${i}`,row:'Official API',theory:t&&!project?normalize(t.slots_offered):'',lab:l?normalize(l.slots_offered):'',pairs:l?[normalize(l.slots_offered)]:[],theoryFaculty:t?.faculty_name||'',labFaculty:l?.faculty_name||'',theoryVenue:t?.venue||'',labVenue:l?.venue||'',venue:combined?'':(t||l).venue,project,warnings:[]};
  events(option);return option;
 });
 return {id:previous?.id||`${code}|${info.course_name}`,code,name:info.course_name,category:previous?.category||'Official offerings',credits:Number(info.credits)||0,options};
}
