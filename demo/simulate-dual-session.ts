/**
 * Parallax Dual-Session Collaborative Investigation Simulation Harness
 * Simulates Alice (Cursor) and Bob (Claude Code) connecting over HTTP MCP transport simultaneously.
 */

const BASE_URL = 'http://localhost:3100/mcp';

async function sendMcpRequest(token: string, method: string, params: any = {}, id: number = 1) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

async function runDemo() {
  console.log('\n🚀 ═════════════════════════════════════════════════════════════════════');
  console.log('   PARALLAX COLLABORATIVE DUAL-ENGINEER INVESTIGATION SIMULATION');
  console.log('   Participants: Alice (Cursor) & Bob (Claude Code)');
  console.log('═════════════════════════════════════════════════════════════════════════\n');

  // Step 1: Initialize MCP Protocol for both clients
  console.log('📡 [Step 1] Connecting clients to Parallax MCP server...');
  const aliceInit = await sendMcpRequest('user_alice_cursor', 'initialize');
  const bobInit = await sendMcpRequest('user_bob_claude', 'initialize');
  console.log(`   ✅ Alice connected: ${aliceInit.serverInfo.name} v${aliceInit.serverInfo.version}`);
  console.log(`   ✅ Bob connected: ${bobInit.serverInfo.name} v${bobInit.serverInfo.version}\n`);

  // Step 2: Tools Discovery (Airis Schema Partitioning)
  console.log('📋 [Step 2] Querying tools/list (Testing Schema Partitioning)...');
  const toolsResult = await sendMcpRequest('user_alice_cursor', 'tools/list');
  console.log(`   ✅ Discovered ${toolsResult.tools.length} registered tools:`);
  toolsResult.tools.forEach((t: any) => console.log(`      • ${t.name.padEnd(35)} - ${t.description.slice(0, 50)}...`));
  console.log('');

  // Step 3: Alice starts the investigation session
  console.log('🚨 [Step 3] Alice detects alert and creates shared session in Cursor...');
  const createSessionRes = await sendMcpRequest('user_alice_cursor', 'tools/call', {
    name: 'investigation__create_session',
    arguments: {
      incident_id: 'INC-402',
      title: 'Checkout Service 500 Connection Timeout in GCP',
    },
  }, 2);

  const sessionData = JSON.parse(createSessionRes.content[0].text);
  const sessionId = sessionData.session_id;
  console.log(`   ✅ Session Created: ${sessionData.incident_id} (ID: ${sessionId})`);
  console.log(`      Title: "${sessionData.title}"\n`);

  // Step 4: Alice queries GCP Cloud Logging
  console.log('🔍 [Step 4] Alice searches GCP Cloud Logging for errors...');
  const gcpLogRes = await sendMcpRequest('user_alice_cursor', 'tools/call', {
    name: 'gcp__search_logs',
    arguments: {
      filter: 'resource.type="k8s_container" AND severity>=ERROR',
      minutes: 15,
    },
  }, 3);

  const gcpLogData = JSON.parse(gcpLogRes.content[0].text);
  console.log(`   ✅ GCP Logs Returned: ${gcpLogData.count} error entries found.`);
  console.log(`      Sample log: "${gcpLogData.logs[0].payload.message}"`);
  console.log(`      Cache Hit: ${gcpLogData._cache?.hit ? 'YES' : 'NO (Fresh Query)'}\n`);

  // Step 5: Alice queries Sentry (Verifying Cross-Vendor Correlation)
  console.log('🔍 [Step 5] Alice queries Sentry issues (Testing Cross-Vendor Correlation)...');
  const sentryRes = await sendMcpRequest('user_alice_cursor', 'tools/call', {
    name: 'sentry__search_issues',
    arguments: {
      query: 'is:unresolved',
      minutes: 60,
    },
  }, 4);

  const sentryData = JSON.parse(sentryRes.content[0].text);
  console.log(`   ✅ Sentry Issues Returned: ${sentryData.count} unresolved issues.`);
  console.log(`      Issue Title: "${sentryData.issues[0].title}"`);
  if (sentryData._correlation) {
    console.log(`   ⚡ [PARALLAX CORRELATION ENGINE DETECTED]:`);
    console.log(`      Signal: ${sentryData._correlation.anomaly_signal}`);
    console.log(`      Correlated Deploy: Commit ${sentryData._correlation.github_deploys_in_window[0].commit} by ${sentryData._correlation.github_deploys_in_window[0].author}`);
  }
  console.log('');

  // Step 6: Bob opens Claude Code, discovers the open session, and joins
  console.log('🤝 [Step 6] Bob joins the investigation from Claude Code...');
  const listSessionsRes = await sendMcpRequest('user_bob_claude', 'tools/call', {
    name: 'investigation__list_open_sessions',
  }, 5);
  const openSessions = JSON.parse(listSessionsRes.content[0].text);
  console.log(`   ✅ Bob found ${openSessions.count} active incident session.`);

  await sendMcpRequest('user_bob_claude', 'tools/call', {
    name: 'investigation__join_session',
    arguments: { session_id: sessionId },
  }, 6);
  console.log(`   ✅ Bob successfully joined session ${sessionId}.\n`);

  // Step 7: Bob checks co-pilot activity stream
  console.log('🔄 [Step 7] Bob syncs co-pilot activity stream to see Alice\'s prior findings...');
  const activityRes = await sendMcpRequest('user_bob_claude', 'tools/call', {
    name: 'investigation__get_session_activity',
    arguments: { session_id: sessionId },
  }, 7);
  const activity = JSON.parse(activityRes.content[0].text);
  console.log(`   ✅ Retrieved ${activity.total_events} previous investigation steps:`);
  activity.timeline.forEach((e: any) => {
    console.log(`      • [${e.userName}]: ${e.toolName} → ${e.outputSummary}`);
  });
  console.log('');

  // Step 8: Bob queries the EXACT same GCP log filter (Verifying Redis Shared Cache Hit!)
  console.log('⚡ [Step 8] Bob runs duplicate GCP log query (Testing Shared Redis Cache)...');
  const bobGcpRes = await sendMcpRequest('user_bob_claude', 'tools/call', {
    name: 'gcp__search_logs',
    arguments: {
      filter: 'resource.type="k8s_container" AND severity>=ERROR',
      minutes: 15,
    },
  }, 8);

  const bobGcpData = JSON.parse(bobGcpRes.content[0].text);
  console.log(`   🎯 [CACHE VERIFICATION]:`);
  console.log(`      Cache Hit: ${bobGcpData._cache?.hit ? '✅ TRUE (0ms response from Redis)' : '❌ FALSE'}`);
  console.log(`      Served By: ${bobGcpData._cache?.served_by || 'upstream'}\n`);

  // Step 9: Bob inspects GitHub deployments to confirm the root cause
  console.log('📦 [Step 9] Bob queries GitHub deployments for the payment service...');
  const githubRes = await sendMcpRequest('user_bob_claude', 'tools/call', {
    name: 'github__list_deployments',
    arguments: {
      owner: 'acme-payments',
      repo: 'payment-service',
      minutes: 120,
    },
  }, 9);
  const githubData = JSON.parse(githubRes.content[0].text);
  console.log(`   ✅ GitHub Deployments: Found release with commit message:`);
  console.log(`      "${githubData.deployments[0].commitMessage}"\n`);

  // Step 10: Closing the session and generating the Living Postmortem
  console.log('📝 [Step 10] Bob closes the incident session with root cause verdict...');
  const closeRes = await sendMcpRequest('user_bob_claude', 'tools/call', {
    name: 'investigation__close_session',
    arguments: {
      session_id: sessionId,
      verdict: 'Root Cause: Pull Request #892 incorrectly reduced DB connection pool to 10 connections, starving production checkout pods under peak traffic. Remediated by rolling back to commit 8f3b1ae9.',
    },
  }, 10);

  const closeData = JSON.parse(closeRes.content[0].text);
  console.log('   ✅ Incident Resolved & Closed!');
  console.log('\n📄 ════════════════ AUTO-GENERATED LIVING POSTMORTEM ═════════════════');
  console.log(closeData.postmortem_report);
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  console.log('🎉 Dual-engineer simulation completed with 100% success!\n');
}

runDemo().catch((err) => {
  console.error('\n❌ Demo execution failed:', err);
  process.exit(1);
});
