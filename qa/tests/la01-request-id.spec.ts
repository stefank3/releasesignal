import { test, expect } from '@playwright/test';
import { openHarness, bodyFor, gate, executionPayload, type Harness } from '../helpers/la01-request-id-harness';

const baselineRun = process.env.LA01_TEST_PHASE === 'baseline';
let h: Harness;
test.beforeEach(async () => { h = await openHarness(); });
test.afterEach(async () => { if (h) { await h.close(); h = undefined as unknown as Harness; } });

for (const kind of ['ordinary', 'explicit', 'ingestion'] as const) {
  test(`${baselineRun ? 'baseline reproduction' : 'completed conflict'}: ${kind}`, async () => {
    const id = h.requestId();
    const first = await h.call(h.subjects[0], id, bodyFor(kind, h.sessions[0]));
    expect(first.status, JSON.stringify({ first, errors: h.errors })).toBe(200);
    const afterFirst = await h.snapshot(id);
    expect(afterFirst).toMatchObject({ balance: 99, debits: 1, assistants: 1 });
    const debitBefore = await h.db.creditLedger.findUniqueOrThrow({ where: {
      walletId_reason_requestId: { walletId: h.wallets[0], reason: 'chat_usage', requestId: id },
    } });
    const beforeB = await h.db.chatSession.findUniqueOrThrow({ where: { id: h.sessions[1] } });
    const calls = { ...h.counters };
    const second = await h.call(h.subjects[0], id, bodyFor(kind, h.sessions[1]));
    const afterSecond = await h.snapshot(id);
    expect(await h.db.creditLedger.findUniqueOrThrow({ where: { id: debitBefore.id } })).toEqual(debitBefore);
    if (baselineRun) {
      expect(second.status, JSON.stringify({ second, errors: h.errors })).toBe(200);
      expect(afterSecond).toEqual({ balance: 99, debits: 1, assistants: 2 });
      if (kind !== 'ingestion') expect(second.model).toBeGreaterThan(0);
    } else {
      expect(second.status).toBe(409);
      expect(second.body).toEqual({ ok: false, error: 'REQUEST_ID_CONFLICT' });
      expect(second.requestId).toBe(id);
      expect(h.counters).toEqual(calls);
      expect(afterSecond).toEqual(afterFirst);
      expect(h.metrics.at(-1)?.status).toBe(409);
      expect(await h.db.chatMessage.count({ where: { sessionId: h.sessions[1] } })).toBe(0);
      const afterB = await h.db.chatSession.findUniqueOrThrow({ where: { id: h.sessions[1] } });
      expect(afterB.artifactJson).toEqual(beforeB.artifactJson);
      expect(afterB.artifactUpdatedAt).toEqual(beforeB.artifactUpdatedAt);
      // Session mode/updatedAt may change before the new guard. They are not part of its promise.
    }
    console.info(JSON.stringify({ scenario: kind, baseline: baselineRun, firstStatus: first.status,
      secondStatus: second.status, secondModelCalls: second.model, secondRepairCalls: second.repair, afterFirst, afterSecond }));
  });
}

test('legitimate ordinary replay, fresh ID, and independent wallet', async () => {
  test.skip(baselineRun);
  const id = h.requestId(), body = bodyFor('ordinary', h.sessions[0]);
  expect((await h.call(h.subjects[0], id, body)).status).toBe(200);
  const before = await h.snapshot(id), calls = { ...h.counters };
  const replay = await h.call(h.subjects[0], id, body);
  expect(replay.status).toBe(200); expect(replay.body.replay).toBe(true);
  expect(h.counters).toEqual(calls); expect(await h.snapshot(id)).toEqual(before);
  const independent = await h.call(h.subjects[2], id, bodyFor('ordinary', h.sessions[3]));
  expect(independent.status).toBe(200); expect(independent.model).toBeGreaterThan(0);
  expect(await h.snapshot(id, h.wallets[1])).toMatchObject({ balance: 99, debits: 1 });
  expect((await h.call(h.subjects[0], h.requestId(), body)).status).toBe(200);
  expect((await h.snapshot(id)).balance).toBe(98);
});

test('conflict precedes repair and shared-wallet execution', async () => {
  test.skip(baselineRun);
  const control = await h.call(h.subjects[0], h.requestId(), { ...bodyFor('ingestion', h.sessions[0]), message: 'invalid execution input' }, { repairReply: executionPayload });
  expect(control.status).toBe(200); expect(control.repair).toBe(1);
  const id = h.requestId();
  expect((await h.call(h.subjects[0], id, bodyFor('ordinary', h.sessions[0]))).status).toBe(200);
  const before = await h.snapshot(id), calls = { ...h.counters };
  for (const [subject, session] of [[h.subjects[0], h.sessions[1]], [h.subjects[1], h.sessions[2]]]) {
    const result = await h.call(subject, id, { ...bodyFor('ingestion', session), message: 'would need repair' }, { repairReply: executionPayload });
    expect(result.status).toBe(409); expect(result.body).toEqual({ ok: false, error: 'REQUEST_ID_CONFLICT' });
  }
  expect(h.counters).toEqual(calls); expect(await h.snapshot(id)).toEqual(before);
});

test('in-flight cross-session duplicates remain open (controlled commit ordering)', async () => {
  test.skip(baselineRun);
  const id = h.requestId(), a = gate(), b = gate();
  const first = h.call(h.subjects[0], id, bodyFor('ordinary', h.sessions[0]), { gate: a });
  const second = h.call(h.subjects[0], id, bodyFor('ordinary', h.sessions[1]), { gate: b });
  try {
    await Promise.all([a.waiting, b.waiting]);
    a.release(); const resultA = await first;
    b.release(); const resultB = await second;
    expect(resultA.status).toBe(200); expect(resultB.status).toBe(200);
    expect(resultA.model).toBeGreaterThan(0); expect(resultB.model).toBeGreaterThan(0);
    expect(await h.snapshot(id)).toEqual({ balance: 99, debits: 1, assistants: 2 });
    console.info(JSON.stringify({ residual: 'in-flight cross-session', statuses: [resultA.status, resultB.status],
      modelCalls: resultA.model + resultB.model, snapshot: await h.snapshot(id) }));
  } finally { a.release(); b.release(); await Promise.allSettled([first, second]); }
});

test('new-session client ID resolves to legitimate same-session replay', async () => {
  test.skip(baselineRun);
  const id = h.requestId(), clientId = h.requestId();
  const body = { sessionClientId: clientId, mode: 'coach',
    message: 'Refine a requirement: an authenticated user resets a password with a single-use token.' };
  const first = await h.call(h.subjects[0], id, body);
  expect(first.status).toBe(200);
  expect(first.body.sessionId).toBeTruthy();
  const before = await h.snapshot(id), calls = { ...h.counters };
  for (const retry of [body, { ...body, sessionId: first.body.sessionId }]) {
    const result = await h.call(h.subjects[0], id, retry);
    expect(result.status).toBe(200); expect(result.body.replay).toBe(true);
    expect(result.body.sessionId).toBe(first.body.sessionId);
  }
  expect(await h.snapshot(id)).toEqual(before); expect(h.counters).toEqual(calls);
});

test('ambiguous historical associations and nullable debit actor fail closed', async () => {
  test.skip(baselineRun);
  const id = h.requestId(), body = bodyFor('ordinary', h.sessions[0]);
  expect((await h.call(h.subjects[0], id, body)).status).toBe(200);
  const calls = { ...h.counters };
  const other = await h.db.chatMessage.create({ data: { sessionId: h.sessions[2], auth0Sub: h.subjects[1],
    requestId: id, role: 'assistant', content: 'Synthetic historical ambiguity' } });
  expect((await h.call(h.subjects[0], id, body)).status).toBe(409);
  await h.db.chatMessage.delete({ where: { id: other.id } });
  await h.db.creditLedger.update({ where: { walletId_reason_requestId: {
    walletId: h.wallets[0], reason: 'chat_usage', requestId: id } }, data: { auth0Sub: null } });
  expect((await h.call(h.subjects[0], id, body)).status).toBe(409);
  expect(h.counters).toEqual(calls);
  expect(await h.snapshot(id)).toEqual({ balance: 99, debits: 1, assistants: 1 });
});

test('same-session changed payload/action and review miss remain characterized, not fixed', async () => {
  test.skip(baselineRun);
  const id = h.requestId(), body = bodyFor('ordinary', h.sessions[0]);
  expect((await h.call(h.subjects[0], id, body)).status).toBe(200);
  const changed = await h.call(h.subjects[0], id, { ...body, message: 'A different request payload.' });
  expect(changed.status).toBe(200); expect(changed.body.replay).toBe(true); expect(changed.model).toBe(0);
  const action = await h.call(h.subjects[0], id, bodyFor('explicit', h.sessions[0]));
  expect(action.model).toBeGreaterThan(0);
  expect(await h.snapshot(id)).toEqual({ balance: 99, debits: 1, assistants: 1 });
  await h.db.chatMessage.updateMany({ where: { sessionId: h.sessions[0], requestId: id, role: 'assistant' }, data: { content: 'unparseable synthetic review' } });
  await h.db.chatSession.update({ where: { id: h.sessions[0] }, data: { artifactJson: {} } });
  const miss = await h.call(h.subjects[0], id, body);
  expect(miss.model).toBeGreaterThan(0);
  expect(await h.snapshot(id)).toEqual({ balance: 99, debits: 1, assistants: 1 });
  console.info(JSON.stringify({ residual: 'same-session reuse', changedPayloadReplay: changed.body.replay,
    changedActionStatus: action.status, changedActionModelCalls: action.model,
    reviewMissStatus: miss.status, reviewMissModelCalls: miss.model }));
});

test('zero-debit completions, short IDs, and exhausted retry stay outside the mitigation', async () => {
  test.skip(baselineRun);
  const zeroId = h.requestId();
  for (const session of h.sessions.slice(0, 2)) {
    expect((await h.call(h.subjects[0], zeroId, bodyFor('ordinary', session), { zeroUsage: true })).status).toBe(200);
  }
  expect(await h.snapshot(zeroId)).toEqual({ balance: 100, debits: 0, assistants: 2 });
  const short = await h.call(h.subjects[0], 'short', bodyFor('ordinary', h.sessions[0]));
  expect(short.status).toBe(500); expect((await h.snapshot('short')).debits).toBe(0);
  const id = h.requestId(), body = bodyFor('ordinary', h.sessions[0]);
  expect((await h.call(h.subjects[0], id, body)).status).toBe(200);
  await h.db.$transaction(async tx => {
    await tx.creditWallet.update({ where: { id: h.wallets[0] }, data: { balance: 0 } });
    await tx.creditLedger.create({ data: { walletId: h.wallets[0], auth0Sub: h.subjects[0],
      delta: -99, reason: 'la01_synthetic_exhaustion', requestId: h.requestId() } });
  });
  const exhausted = await h.call(h.subjects[0], id, body);
  expect(exhausted.status).toBe(402); expect(exhausted.model).toBe(0);
  console.info(JSON.stringify({ residual: 'zero debit / short ID / exhaustion', zeroDebitAssistants: 2,
    shortIdStatus: short.status, exhaustedRetryStatus: exhausted.status }));
});

test('foreign session remains unauthorized before model execution', async () => {
  test.skip(baselineRun);
  const before = await h.db.chatSession.findUniqueOrThrow({ where: { id: h.sessions[0] } });
  const result = await h.call(h.subjects[2], h.requestId(), bodyFor('ordinary', h.sessions[0]));
  expect(result.status).not.toBe(200); expect(result.model).toBe(0); expect(result.repair).toBe(0);
  expect(await h.db.chatSession.findUniqueOrThrow({ where: { id: h.sessions[0] } })).toEqual(before);
  expect(await h.db.chatMessage.count({ where: { sessionId: h.sessions[0] } })).toBe(0);
  console.info(JSON.stringify({ ownershipControlStatus: result.status }));
});

test('in-flight same-session duplicates characterize actual transaction recovery', async () => {
  test.skip(baselineRun);
  const id = h.requestId(), a = gate(), b = gate(), body = bodyFor('ordinary', h.sessions[0]);
  const first = h.call(h.subjects[0], id, body, { gate: a });
  const second = h.call(h.subjects[0], id, body, { gate: b });
  try {
    await Promise.all([a.waiting, b.waiting]);
    a.release(); const resultA = await first;
    b.release(); const resultB = await second;
    expect(resultA.status).toBe(200); expect(resultA.model).toBeGreaterThan(0); expect(resultB.model).toBeGreaterThan(0);
    expect(await h.snapshot(id)).toEqual({ balance: 99, debits: 1, assistants: 1 });
    console.info(JSON.stringify({ residual: 'in-flight same-session', statuses: [resultA.status, resultB.status],
      modelCalls: resultA.model + resultB.model, snapshot: await h.snapshot(id) }));
  } finally { a.release(); b.release(); await Promise.allSettled([first, second]); }
});
