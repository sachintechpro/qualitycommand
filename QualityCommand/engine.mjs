/** QualityCommand v1: transparent, deterministic QA capacity and release-governance simulation. */
export const CAPACITY = Object.freeze({ qaLeads: 4, functional: 9, automation: 4, productiveHoursPerWeek: 30 });
export const PROJECTS = Object.freeze([
  {id:'policy',name:'Policy Administration Upgrade',domain:'Insurance core platform',weeksToRelease:4,manualHours:410,automationHours:95,baselineCoverage:88,passRate:93,sev1:0,sev2:2,sev3:7,uatApproved:false,regulated:true},
  {id:'portal',name:'Customer Self-Service Portal',domain:'Digital insurance',weeksToRelease:3,manualHours:260,automationHours:130,baselineCoverage:92,passRate:97,sev1:0,sev2:1,sev3:4,uatApproved:true,regulated:false},
  {id:'identity',name:'Identity & Access Platform',domain:'IAM and security',weeksToRelease:5,manualHours:270,automationHours:105,baselineCoverage:86,passRate:91,sev1:1,sev2:2,sev3:5,uatApproved:false,regulated:true},
  {id:'api',name:'Financial Services API Modernization',domain:'Enterprise integration',weeksToRelease:3,manualHours:300,automationHours:75,baselineCoverage:91,passRate:95,sev1:0,sev2:3,sev3:3,uatApproved:true,regulated:false},
]);
export const INITIAL = Object.freeze({
  allocations: {
    policy:{qaLeads:1,functional:3,automation:1},
    portal:{qaLeads:1,functional:2,automation:1},
    identity:{qaLeads:1,functional:2,automation:1},
    api:{qaLeads:1,functional:2,automation:1}
  },
  actions:{policy:{},portal:{},identity:{},api:{}}
});
export const ACTIONS = Object.freeze([
  {id:'riskBased',title:'Risk-prioritized regression',detail:'Reduce manual work 15%; modeled coverage decreases 5 points; requires documented exclusions.'},
  {id:'automationBoost',title:'Reusable automation acceleration',detail:'Reduce remaining automation effort 20%; adds 20 manual validation hours for framework/review.'},
  {id:'deferScope',title:'Defer approved low-risk scope',detail:'Reduce manual work 20%; requires product owner/change approval and does not waive release gates.'},
  {id:'defectSwarm',title:'Cross-functional defect swarm',detail:'Adds 60 manual triage/retest hours; assumes one Sev-2 defect can be resolved, pending verification.'}
]);
export const RULES = Object.freeze({minCoverage:90,minPassRate:95,maxSev2:2});
const TYPES=['qaLeads','functional','automation'];
const isNonNegativeInt = x=>Number.isInteger(x)&&x>=0;
export function validateState(state) {
  if(!state||typeof state!=='object'||!state.allocations||!state.actions)throw new Error('Invalid scenario structure');
  for(const p of PROJECTS){
    const a=state.allocations[p.id],flags=state.actions[p.id];
    if(!a||!flags)throw new Error(`Missing project configuration: ${p.id}`);
    for(const t of TYPES)if(!isNonNegativeInt(a[t]))throw new Error(`Invalid ${t} allocation for ${p.id}`);
    for(const action of ACTIONS)if(flags[action.id]!==undefined&&typeof flags[action.id]!=='boolean')throw new Error(`Invalid action: ${p.id}/${action.id}`);
  }
  return true;
}
export function freshState(){return JSON.parse(JSON.stringify(INITIAL));}
export function simulate(state=INITIAL){
  validateState(state);
  const used=Object.fromEntries(TYPES.map(t=>[t,PROJECTS.reduce((sum,p)=>sum+state.allocations[p.id][t],0)]));
  const remaining=Object.fromEntries(TYPES.map(t=>[t,CAPACITY[t]-used[t]]));
  const overallocation=TYPES.filter(t=>remaining[t]<0);
  const projects=PROJECTS.map(p=>{
    const a=state.allocations[p.id],opt=state.actions[p.id],h=CAPACITY.productiveHoursPerWeek;
    const changes=[];
    let manual=p.manualHours,automation=p.automationHours,coverage=p.baselineCoverage,sev2=p.sev2;
    if(opt.riskBased){manual*=.85;coverage-=5;changes.push('Risk-prioritized exclusions require QA and product approval.');}
    if(opt.automationBoost){automation*=.8;manual+=20;changes.push('Automation acceleration assumes reusable stable tests and approved review effort.');}
    if(opt.deferScope){manual*=.8;changes.push('Scope deferral requires written product, sponsor, and applicable compliance approvals.');}
    if(opt.defectSwarm){manual+=60;sev2=Math.max(0,sev2-1);changes.push('Potential Sev-2 remediation remains provisional until verified and regression-tested.');}
    manual=Math.ceil(manual);automation=Math.ceil(automation);
    const manualCapacity=a.functional*h*p.weeksToRelease,automationCapacity=a.automation*h*p.weeksToRelease;
    const manualGap=Math.max(0,manual-manualCapacity),automationGap=Math.max(0,automation-automationCapacity);
    const manualWeeks=a.functional>0?Math.ceil(manual/(a.functional*h)):null;
    const automationWeeks=a.automation>0?Math.ceil(automation/(a.automation*h)):null;
    const forecastWeeks=manualWeeks===null||automationWeeks===null?null:Math.max(manualWeeks,automationWeeks);
    const qaSlipWeeks=forecastWeeks===null?null:Math.max(0,forecastWeeks-p.weeksToRelease);
    const blockers=[];
    if(a.qaLeads===0)blockers.push('No accountable QA lead assigned');
    if(overallocation.length)blockers.push(`Shared team allocation exceeds available ${overallocation.join(', ')} capacity`);
    if(manualGap>0)blockers.push(`${manualGap} functional test hours exceed pre-release capacity`);
    if(automationGap>0)blockers.push(`${automationGap} automation hours exceed pre-release capacity`);
    if(p.sev1>0)blockers.push(`${p.sev1} open Sev-1 defect(s): release gate blocked`);
    if(sev2>RULES.maxSev2)blockers.push(`${sev2} open/assumed Sev-2 defects exceed gate of ${RULES.maxSev2}`);
    if(coverage<RULES.minCoverage)blockers.push(`Modeled coverage ${coverage}% below ${RULES.minCoverage}% threshold`);
    if(p.passRate<RULES.minPassRate)blockers.push(`Observed pass rate ${p.passRate}% below ${RULES.minPassRate}% threshold`);
    if(!p.uatApproved)blockers.push('Business UAT sign-off remains outstanding');
    if(opt.riskBased)blockers.push('Risk-based scope exclusions require written approval');
    if(opt.deferScope)blockers.push('Deferred scope requires change control approval');
    if(opt.defectSwarm)blockers.push('Modeled Sev-2 resolution requires actual verification');
    const gate=blockers.length?'NOT READY':'CONDITIONAL REVIEW';
    const warnings=[...changes];
    if(!blockers.length)warnings.push('All modeled minimum gates are met; final release authorization remains a human decision.');
    const capacityHealth=manualGap||automationGap?'SHORTFALL':'ON TRACK';
    return {...p,allocation:{...a},options:{...opt},manualRequired:manual,automationRequired:automation,manualCapacity,automationCapacity,manualGap,automationGap,manualWeeks,automationWeeks,forecastWeeks,qaSlipWeeks,modeledCoverage:coverage,modeledSev2:sev2,capacityHealth,gate,blockers,warnings};
  });
  return {projects,used,remaining,overallocation,blocked:projects.filter(p=>p.gate==='NOT READY').length,capacityShortfalls:projects.filter(p=>p.capacityHealth==='SHORTFALL').length,criticalDefects:PROJECTS.reduce((sum,p)=>sum+p.sev1,0)};
}
