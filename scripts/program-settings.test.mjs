import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { programStatusKey, programStatus, programDateLabel, programDateAt, programTitleAt, msUntilProgramChange, watchProgramDate } from '../public/js/program-settings.js';

test('status is scoped to a valid calendar day, unknown values stay pending', () => {
  assert.notEqual(programStatusKey('2026-10-24'), programStatusKey('2026-10-25'));
  for (const day of ['2026-02-30', '2026-13-01', '', '2026-1-1']) assert.throws(() => programStatusKey(day));
  assert.equal(programDateLabel('2026-10-24'), '24 ต.ค. 69');
  assert.equal(programStatus('final'), 'final');
  for (const value of [null, '', 'FINAL', 'pending', '<script>']) assert.equal(programStatus(value), 'pending');
});

// Run the actual public loader with a small DOM and controlled responses.
const source = readFileSync(new URL('../public/js/home.js', import.meta.url), 'utf8');
const body = source.split('async function loadNextProgramStatus(iso) {')[1].split('/** วาดแถบให้ชี้วัน iso')[0].trim().replace(/\}$/, '');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
function harness(fetch) {
  const badge = { hidden: false, dataset: {}, textContent: '' };
  const band = { hidden: false, dataset: { programDate: '2026-10-24' } };
  const load = new AsyncFunction('iso', 'document', 'fetch', 'hasSupabase', 'SUPABASE_URL', 'SUPABASE_KEY', 'programStatusKey', 'programStatus', 'console', body);
  return { badge, band, run: (iso = '2026-10-24') => load(iso, { getElementById: id => id === 'nextBand' ? band : badge }, fetch, () => true, 'https://example.test', 'public-key', programStatusKey, programStatus, { error() {} }) };
}
test('public loader reads Final for the exact day and exposes green state', async () => {
  const h = harness(async (url) => {
    assert.match(url, /key=eq.next_program_status_2026-10-24$/);
    return { ok: true, json: async () => [{ value: 'final' }] };
  });
  await h.run();
  assert.equal(h.badge.textContent, 'Final');
  assert.equal(h.badge.dataset.status, 'final');
  assert.equal(h.badge.hidden, false);
});
test('missing setting and request failure never claim Final', async () => {
  for (const fetch of [async () => ({ ok: true, json: async () => [] }), async () => { throw Error('offline'); }, async () => ({ ok: false })]) {
    const h = harness(fetch);
    await h.run();
    assert.equal(h.badge.textContent, 'ยังไม่เป็นทางการ');
    assert.equal(h.badge.dataset.status, 'pending');
  }
});
test('a delayed old day cannot overwrite the current banner', async () => {
  let resolve;
  const h = harness(() => new Promise(r => { resolve = r; }));
  const pending = h.run();
  h.band.dataset.programDate = '2026-10-25';
  resolve({ ok: true, json: async () => [{ value: 'final' }] });
  await pending;
  assert.equal(h.badge.textContent, '');
});

const adminSource = readFileSync(new URL('../public/admin/admin.js', import.meta.url), 'utf8');
const renderSource = adminSource.slice(adminSource.indexOf('function renderProgramView()'), adminSource.indexOf('async function renderHeroView()'));
function cmsHarness(read) {
  const ids = ['viewBody', 'programForm', 'programDate', 'programStatus', 'programSave', 'programMessage', 'programPreviewDate', 'programPreviewStatus'];
  const elements = Object.fromEntries(ids.map(id => [id, { value: '', dataset: {}, events: {}, addEventListener(name, fn) { this.events[name] = fn; } }]));
  elements.programDate.value = '2026-10-24';
  const writes = [];
  const db = { from(table) {
    assert.equal(table, 'site_settings');
    return { select: () => ({ eq: (_, key) => ({ maybeSingle: () => read(key) }) }), upsert: async (row, options) => { writes.push(row); assert.equal(options.onConflict, 'key'); return {}; } };
  } };
  new Function('$', 'CARD', 'programDateAt', 'programStatusKey', 'programStatus', 'programDateLabel', 'db', 'current', 'friendlyError', 'setSaveState', renderSource + '\nrenderProgramView();')(
    id => elements[id], '', () => '2026-10-24', programStatusKey, programStatus, programDateLabel, db, { id: 'program' }, err => err.message, () => {}
  );
  return { elements, writes };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('CMS saves the chosen status against the chosen date; a different day starts pending', async () => {
  const { elements: e, writes } = cmsHarness(async () => ({ data: null }));
  await settle();
  assert.equal(e.programStatus.value, 'pending');
  e.programStatus.value = 'final';
  await e.programForm.events.submit({ preventDefault() {} });
  assert.deepEqual(writes, [{ key: 'next_program_status_2026-10-24', value: 'final' }]);
  assert.equal(e.programSave.disabled, false);
  e.programDate.value = '2026-10-25';
  await e.programDate.events.change();
  assert.equal(e.programStatus.value, 'pending');
});
test('CMS refuses to overwrite a status it could not load', async () => {
  const { elements: e, writes } = cmsHarness(async () => ({ error: Error('offline') }));
  await settle();
  assert.equal(e.programSave.disabled, true);
  await e.programForm.events.submit({ preventDefault() {} });
  assert.equal(writes.length, 0);
  assert.match(e.programMessage.textContent, /offline/);
});

test('Bangkok noon changes 24 Oct to 25 Oct at exactly 12:01', () => {
  for (const [time, expected] of [
    ['2026-10-24T05:00:59.999Z', '2026-10-24'],
    ['2026-10-24T05:01:00.000Z', '2026-10-25'],
    ['2026-10-24T16:59:59.999Z', '2026-10-25'],
    ['2026-10-24T17:00:00.000Z', '2026-10-25'],
    ['2026-10-31T05:01:00.000Z', '2026-11-01'],
    ['2026-12-31T05:01:00.000Z', '2027-01-01']
  ]) assert.equal(programDateAt(new Date(time)), expected, time);
  assert.equal(msUntilProgramChange(new Date('2026-10-24T05:00:59.999Z')), 1);
  assert.equal(msUntilProgramChange(new Date('2026-10-24T05:01:00.000Z')), 86400000);
  assert.equal(programDateAt(new Date('2026-10-24T05:00:00Z')), '2026-10-24');
});

test('an open page switches at noon and checks again when returning from sleep', () => {
  let now = new Date('2026-10-24T05:00:59Z'), task, delay, visibility;
  const dates = [];
  const page = { hidden: false, addEventListener: (_, fn) => { visibility = fn; }, removeEventListener: () => { visibility = null; } };
  const stop = watchProgramDate(iso => dates.push(iso), {
    now: () => now, setTimeout: (fn, ms) => { task = fn; delay = ms; return 1; }, clearTimeout() {}, document: page
  });
  assert.equal(dates.at(-1), '2026-10-24');
  assert.equal(delay, 1000);
  now = new Date('2026-10-24T05:01:00Z');
  task();
  assert.equal(dates.at(-1), '2026-10-25');
  assert.equal(delay, 60000);
  now = new Date('2026-10-25T06:00:00Z');
  visibility();
  assert.equal(dates.at(-1), '2026-10-26');
  stop();
  assert.equal(visibility, null);
});

function bannerHarness(dayFolder) {
  const ids = ['nextBand', 'nextTitle', 'nextDl', 'nextLinkCaption', 'nextDate', 'nextStatus'];
  const nodes = Object.fromEntries(ids.map(id => [id, {
    dataset: {}, textContent: '', attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; if (name === 'href') delete this.href; }
  }]));
  const code = source.slice(source.indexOf('function showNext('), source.indexOf('/* ===================== ข่าวสาร'));
  const showNext = new Function('document', 'setText', 'programDateLabel', 'programTitleAt', 'loadNextProgramStatus', 'dayFolder', 'driveFolderUrl', 'console',
    'var nextIso = null, nextFolderReady = false, nextFolderLoading = false, nextFolderRequest = 0;\n' + code + '\nreturn showNext;')(
    { getElementById: id => nodes[id] }, (id, value) => { nodes[id].textContent = value; }, programDateLabel, programTitleAt,
    () => {}, dayFolder, id => 'https://drive.google.com/drive/folders/' + id, { error() {} }
  );
  return { nodes, showNext };
}
test('noon clears the old Final and old link before loading the exact new folder', async () => {
  const calls = [];
  const { nodes: n, showNext } = bannerHarness(async (iso, refresh) => {
    calls.push([iso, refresh]);
    return { id: iso === '2026-10-24' ? 'folder24' : 'folder25' };
  });
  showNext('2026-10-24');
  await settle();
  assert.match(n.nextDl.href, /folder24$/);
  n.nextStatus.dataset.status = 'final';
  n.nextStatus.textContent = 'Final';
  showNext('2026-10-25');
  assert.equal(n.nextStatus.textContent, 'ยังไม่เป็นทางการ');
  assert.equal(n.nextStatus.dataset.status, 'pending');
  assert.equal(n.nextDl.href, undefined);
  assert.equal(n.nextDl.attrs['aria-disabled'], 'true');
  assert.equal(n.nextDate.dateTime, '2026-10-25');
  await settle();
  assert.match(n.nextDl.href, /folder25$/);
  assert.equal(n.nextDate.textContent, '25 ต.ค. 69');
  assert.deepEqual(calls, [['2026-10-24', true], ['2026-10-25', true]]);
});
test('an old folder response cannot overwrite the new day; a missing folder stays disabled and retries', async () => {
  let oldResolve;
  const { nodes: n, showNext } = bannerHarness(iso => iso === '2026-10-24' ? new Promise(resolve => { oldResolve = resolve; }) : Promise.resolve(null));
  showNext('2026-10-24');
  showNext('2026-10-25');
  await settle();
  oldResolve({ id: 'old-folder' });
  await settle();
  assert.equal(n.nextDl.href, undefined);
  assert.equal(n.nextLinkCaption.textContent, 'กำลังเตรียมโปรแกรม');
  assert.equal(n.nextDate.textContent, '25 ต.ค. 69');
  showNext('2026-10-25', true);
  await settle();
  assert.equal(n.nextDl.attrs['aria-disabled'], 'true');
});

test('Drive lookup uses the exact day and explicit year, and refresh sees a newly created folder', async () => {
  const { dayFolder } = await import('../public/js/day-files.js');
  const originalFetch = globalThis.fetch;
  let files = [{ id: 'old-year', name: '25Oct25', mimeType: 'application/vnd.google-apps.folder' }];
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ files }) });
  try {
    assert.equal(await dayFolder('2026-10-25', true), null);
    files = [...files, { id: 'correct-folder', name: '25Oct26', mimeType: 'application/vnd.google-apps.folder' }];
    assert.equal((await dayFolder('2026-10-25', true)).id, 'correct-folder');
    files = [{ id: 'no-year', name: '1Jan', mimeType: 'application/vnd.google-apps.folder' }];
    assert.equal((await dayFolder('2027-01-01', true)).id, 'no-year');
  } finally { globalThis.fetch = originalFetch; }
});

test('heading says today through 12:00:59, tomorrow at 12:01, and today again at midnight', async () => {
  assert.equal(programTitleAt(new Date('2026-10-24T04:59:59Z')), 'โปรแกรมการแข่งขันวันนี้');
  assert.equal(programTitleAt(new Date('2026-10-24T05:00:59.999Z')), 'โปรแกรมการแข่งขันวันนี้');
  assert.equal(programTitleAt(new Date('2026-10-24T05:01:00Z')), 'โปรแกรมการแข่งขันวันพรุ่งนี้');
  const { nodes: n, showNext } = bannerHarness(async () => ({ id: 'folder25' }));
  showNext('2026-10-25', false, new Date('2026-10-24T05:01:00Z'));
  await settle();
  assert.equal(n.nextTitle.textContent, 'โปรแกรมการแข่งขันวันพรุ่งนี้');
  showNext('2026-10-25', true, new Date('2026-10-24T17:00:00Z'));
  assert.equal(n.nextTitle.textContent, 'โปรแกรมการแข่งขันวันนี้');
  assert.match(n.nextDl.href, /folder25$/);
});
