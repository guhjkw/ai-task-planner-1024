// tests/verify.js  —  node tests/verify.js
// Tests the same src/plannerEngine.js that index.html loads.
'use strict';
var P = require('../src/plannerEngine.js');
var D = require('../data/sample.json');
var passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('PASS: ' + name); } else { failed++; console.log('FAIL: ' + name); } }
function tasks() { return JSON.parse(JSON.stringify(D.tasks)); }
function row(r, id) { return r.rows.filter(function (x) { return x.id === id; })[0]; }
var R = P.plan(D.tasks);

console.log('1. The sample week');
check('9 tasks, 26.5 hours a week', R.rows.length === 9 && R.totals.taskHours === 26.5);
check('about 14.2 hours saved a week from the 8 worth doing', R.totals.hoursSaved === 14.2 && R.roadmap.notYet.length === 1);
check('build cost $1,170 (39 hours at $30)', R.totals.buildCost === 1170 && R.totals.buildHours === 39);
check('pays back in about 1.7 weeks at $50 an hour of your time', R.totals.paybackWeeks === 1.7);

console.log('\n2. Scoring');
check('typing a call list into a sheet is a high fit (23 points)', row(R, 't7').fit === 'high' && row(R, 't7').points === 23);
check('negotiating with suppliers is a low fit (1 point)', row(R, 't9').fit === 'low' && row(R, 't9').points === 1);
check('editing photos is a medium fit', row(R, 't8').fit === 'medium');
check('paper receipts score lower than the same task already digital', P.score({ repetitive: 5, judgment: 1, digital: false, risk: 'low' }).points + 3 === P.score({ repetitive: 5, judgment: 1, digital: true, risk: 'low' }).points);
check('higher risk lowers the score', P.score({ repetitive: 4, judgment: 3, digital: true, risk: 'high' }).points < P.score({ repetitive: 4, judgment: 3, digital: true, risk: 'low' }).points);

console.log('\n3. Who approves');
check('social posts: AI drafts, you approve', row(R, 't1').mode === 'AI drafts, you approve');
check('replying to customers: AI drafts, you approve', row(R, 't4').mode === 'AI drafts, you approve');
check('the weekly numbers report runs on its own', row(R, 't6').mode === 'Runs on its own, alerts you on errors');

console.log('\n4. Roadmap');
check('week 1 is the fastest payback: social posts', R.roadmap.week1[0].id === 't1');
check('weeks 2 to 4: the call list and DMs', R.roadmap.weeks2to4.map(function (x) { return x.id; }).join() === 't7,t2');
check('supplier negotiation is "not yet"', R.roadmap.notYet[0].id === 't9');
check('raising the value of your time shortens payback', P.plan(D.tasks, { ownerRate: 100 }).totals.paybackWeeks < R.totals.paybackWeeks);
check('a 1-week payback limit moves everything to "not yet"', P.plan(D.tasks, { notWorthWeeks: 1 }).roadmap.notYet.length === 9);
check('cutting a task to half an hour drops it down the roadmap', (function () { var t = tasks(); t[0].hoursPerWeek = 0.5; return P.plan(t).roadmap.week1[0].id !== 't1'; })());

console.log('\n5. Bad input');
check('a task with no name and 0 hours is skipped with reasons', (function () { var t = tasks(); t.push({ id: 'x', name: '', category: 'data', hoursPerWeek: 0, repetitive: 3, judgment: 3, digital: true, risk: 'low' }); var r = P.plan(t); return r.skipped.length === 1 && /name/.test(r.skipped[0].reasons.join()) && /hours/.test(r.skipped[0].reasons.join()) && r.rows.length === 9; })());
check('repetitive 9 and an unknown risk are refused', P.check({ name: 'x', category: 'data', hoursPerWeek: 2, repetitive: 9, judgment: 3, risk: 'extreme' }).length === 2);
check('an empty week returns zero totals, no crash', (function () { var r = P.plan([]); return r.totals.hoursSaved === 0 && r.totals.paybackWeeks === null; })());

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
