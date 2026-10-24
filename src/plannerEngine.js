// src/plannerEngine.js
// The real logic behind the AI automation planner preview.
// index.html and tests/verify.js load THIS file. It scores each weekly task for how
// well AI and automation fit, estimates hours saved, build cost and payback, decides
// whether a person must approve the output, and orders everything into a roadmap.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlannerEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULTS = {
    ownerRate: 50,                          // what an hour of your time is worth ($)
    buildRate: 30,                          // build cost per hour ($)
    savePct: { high: 0.6, medium: 0.35, low: 0.1 },  // share of the task's hours saved, by fit
    notWorthWeeks: 26                       // payback longer than this goes to "not yet"
  };
  var CATS = {
    content: { build: 6, recipe: 'One weekly brief → AI drafts a post per channel → you approve → scheduled in Meta Business Suite or Buffer', tools: 'Claude or ChatGPT, Notion, Meta Business Suite' },
    leads: { build: 5, recipe: 'Facebook, Instagram and website leads → one CRM → instant reply → a follow-up only if they haven\'t booked', tools: 'HubSpot or GoHighLevel, Zapier or Make' },
    inbox: { build: 6, recipe: 'Messages labelled by topic → AI drafts the reply from your past answers → you send', tools: 'Gmail or Meta inbox, Claude, Zapier or Make' },
    bookkeeping: { build: 5, recipe: 'Receipts forwarded or photographed → amounts and vendors read into a sheet → categorized by your rules → you review weekly', tools: 'Gmail, Google Sheets, your accounting app' },
    reporting: { build: 4, recipe: 'Numbers pulled from your store, CRM and ads every Monday → one short summary email', tools: 'Google Sheets, Make or n8n' },
    data: { build: 4, recipe: 'Forms and lists cleaned and synced automatically, no copy and paste', tools: 'Google Sheets, Zapier or Make' },
    creative: { build: 3, recipe: 'Templates and AI-assisted edits for the repeat parts; you do the final pass', tools: 'Canva, AI image tools' },
    calls: { build: 8, recipe: 'Notes and outcomes logged by a short form; the conversation stays yours', tools: 'Google Forms, CRM' }
  };
  var RISK = { low: 0, medium: 2, high: 5 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function settingsOf(s) { var d = clone(DEFAULTS); s = s || {}; Object.keys(s).forEach(function (k) { if (k === 'savePct') Object.assign(d.savePct, s.savePct); else d[k] = s[k]; }); return d; }
  function r1(n) { return Math.round(n * 10) / 10; }

  // Input check: skip and report bad rows instead of crashing.
  function check(t) {
    var why = [];
    if (!t || !String(t.name || '').trim()) why.push('task name missing');
    if (!t || !CATS[t.category]) why.push('pick a category');
    var h = Number(t && t.hoursPerWeek);
    if (!isFinite(h) || h <= 0 || h > 60) why.push('hours per week must be between 0 and 60');
    ['repetitive', 'judgment'].forEach(function (k) { var v = Number(t && t[k]); if (!(v >= 1 && v <= 5)) why.push(k + ' must be 1 to 5'); });
    if (!t || RISK[t.risk] === undefined) why.push('risk must be low, medium or high');
    return why;
  }

  function score(t) {
    var s = Number(t.repetitive) * 2 + (6 - Number(t.judgment)) * 2 + (t.digital ? 3 : 0) - RISK[t.risk];
    return { points: s, fit: s >= 14 ? 'high' : s >= 9 ? 'medium' : 'low' };
  }

  function plan(tasks, opts) {
    var s = settingsOf(opts), rows = [], skipped = [];
    (tasks || []).forEach(function (t) {
      var why = check(t); if (why.length) { skipped.push({ id: t && t.id, name: (t && t.name) || '(no name)', reasons: why }); return; }
      var sc = score(t), c = CATS[t.category], hours = Number(t.hoursPerWeek);
      var saved = r1(hours * s.savePct[sc.fit]), cost = c.build * s.buildRate, weekly = saved * s.ownerRate;
      var payback = weekly > 0 ? Math.ceil(cost / weekly * 10) / 10 : Infinity;
      var approve = t.risk !== 'low' || t.category === 'content' || t.category === 'inbox';
      rows.push({ id: t.id, name: t.name, category: t.category, hours: hours, fit: sc.fit, points: sc.points, saved: saved, cost: cost, weeklyValue: Math.round(weekly), payback: payback,
        mode: approve ? 'AI drafts, you approve' : 'Runs on its own, alerts you on errors', recipe: c.recipe, tools: c.tools, buildHours: c.build });
    });
    rows.sort(function (a, b) { return a.payback - b.payback || b.saved - a.saved || String(a.name).localeCompare(String(b.name)); });
    var worth = rows.filter(function (r) { return r.fit !== 'low' && r.payback <= s.notWorthWeeks; });
    var notYet = rows.filter(function (r) { return worth.indexOf(r) < 0; });
    var road = { week1: worth.slice(0, 1), weeks2to4: worth.slice(1, 3), later: worth.slice(3), notYet: notYet };
    var savedW = r1(worth.reduce(function (a, r) { return a + r.saved; }, 0)), cost = worth.reduce(function (a, r) { return a + r.cost; }, 0);
    var totalHours = r1(rows.reduce(function (a, r) { return a + r.hours; }, 0));
    return { rows: rows, skipped: skipped, roadmap: road,
      totals: { taskHours: totalHours, hoursSaved: savedW, monthlyValue: Math.round(savedW * s.ownerRate * 52 / 12), buildCost: cost, buildHours: worth.reduce(function (a, r) { return a + r.buildHours; }, 0),
        paybackWeeks: savedW > 0 ? Math.ceil(cost / (savedW * s.ownerRate) * 10) / 10 : null } };
  }

  return { DEFAULTS: DEFAULTS, CATEGORIES: CATS, plan: plan, score: score, check: check };
});
