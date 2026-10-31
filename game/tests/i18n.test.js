import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AR } from '../js/i18n/ar.js';
import { setLang, t, L, tr } from '../js/i18n.js';
import { BUILDINGS } from '../js/data/buildings.js';
import { HEROES } from '../js/data/heroes.js';
import { RESEARCH } from '../js/data/research.js';
import { ITEMS } from '../js/data/items.js';
import { TROOP_TYPES, TIER_NAMES } from '../js/data/troops.js';
import { STORY, ACHIEVEMENTS, TIMED_EVENTS, EVENTS } from '../js/data/missions.js';
import { CHAPTERS, ZOMBIE_KINDS, BOSSES } from '../js/data/enemies.js';

test('every piece of game content has an Arabic translation', () => {
  const missing = [];
  const need = (s) => { if (s && !AR[s]) missing.push(s); };
  for (const d of Object.values(BUILDINGS)) { need(d.name); need(d.desc); Object.keys(d.effect(1)).forEach(need); }
  for (const h of HEROES) { need(h.name); need(h.title); need(h.quote); need(h.bio); h.skills.forEach((s) => { need(s.name); need(s.desc); }); }
  RESEARCH.forEach((r) => { need(r.name); need(r.desc); });
  Object.values(ITEMS).forEach((i) => { need(i.name); need(i.desc); });
  Object.values(TROOP_TYPES).forEach((x) => need(x.name)); TIER_NAMES.forEach(need);
  STORY.forEach((s) => need(s.text)); ACHIEVEMENTS.forEach((a) => need(a.name)); TIMED_EVENTS.forEach((e) => { need(e.name); need(e.desc); }); Object.values(EVENTS).forEach(need);
  CHAPTERS.forEach((c) => need(c.name)); Object.values(ZOMBIE_KINDS).forEach((z) => need(z.name)); Object.values(BOSSES).forEach((b) => need(b.name));
  assert.deepEqual(missing, []);
});
test('translations keep their placeholders', () => {
  const bad = Object.entries(AR).filter(([k, v]) => [...k.matchAll(/\{\w+\}/g)].some(([p]) => !v.includes(p)) && !/march\{1\}|queue\{1\}/.test(k));
  assert.deepEqual(bad.map(([k]) => k), []);
});
test('translator: templates, data values and fallback', () => {
  setLang('ar');
  assert.equal(t('Upgrade'), 'ترقية');
  assert.equal(L`Level ${3} / ${25}`, 'المستوى 3 / 25');
  assert.equal(L`${'Barracks'} reached Lv ${4}`, 'الثكنة وصل للمستوى 4');
  assert.equal(tr('  Heroes '), '  الأبطال ');
  assert.equal(t('Some untranslated text'), 'Some untranslated text');
  setLang('en');
  assert.equal(L`Level ${3} / ${25}`, 'Level 3 / 25');
  assert.equal(t('Upgrade'), 'Upgrade');
});
