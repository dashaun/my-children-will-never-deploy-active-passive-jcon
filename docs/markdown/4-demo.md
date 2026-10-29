## You've never run a game day

<blockquote>You have a failover runbook.
Have you ever actually run it?</blockquote>

<div class="big sub">Let's do one right now, <span class="accent">live</span>.</div>

Notes:
16:45 (0:35)
- Before we touch the demo, one question.
- That failover runbook sitting in your wiki? When was the last time you followed it, for real?
- INTERACTIVE: show of hands. "Who has a failover runbook?" Then: "Keep your hand up if you've actually run it in the last year." Watch the hands drop.
- If your answer is "never" or "in a load test two years ago," you're not alone. That's the norm.
- So let's run a game day right now. Purposefully. On-stage. And watch the app not care.

---

# The Demo

## Five active regions. Zero standby.

<div class="caption">This is running live, right now.</div>

Notes:
17:20 (0:25)
- Enough theory, let's see it.
- Five regions, each running the same Spring Boot app on its own GemFire cluster, behind one global load balancer. We're going to lose an entire region live and come back.
- Everything you're about to watch is in the repo.

---

## The stack

<table class="data">
  <tr><th>layer</th><th>technology</th></tr>
  <tr><td>App</td><td>Spring Boot 4.1 / IBM Semeru Java 25, one per region</td></tr>
  <tr><td>Data grid</td><td>VMware GemFire 10.3 (5 clusters)</td></tr>
  <tr><td>Replication</td><td>GemFire WAN gateway senders</td></tr>
  <tr><td>Global LB</td><td>Spring Cloud Gateway: weighted, health-checked, retry</td></tr>
  <tr><td>Distance</td><td>Toxiproxy: +150 to +300 ms to regions 2–5</td></tr>
  <tr><td>Observability</td><td>Actuator + Prometheus + Grafana</td></tr>
</table>

<div class="caption">Five clusters, each a peer, each serving its own writes.</div>

Notes:
17:45 (0:30)
- Quick lay of the land. One Spring Boot app deployed five times, five GemFire clusters, WAN replication between them, Spring Cloud Gateway in front.
- It all runs on this laptop, so Toxiproxy adds real network latency to stand in for distance.
- The one thing that's different from every demo you've seen: there's no shared database in the middle. Each region owns its data.

---

## The five regions

<table class="data">
  <tr><th>region</th><th>app</th><th>grid</th><th>distance</th><th>weight</th></tr>
  <tr><td class="up">region1</td><td>:8081</td><td>:7071</td><td>local</td><td class="up">10</td></tr>
  <tr><td>region2</td><td>:8082</td><td>:7072</td><td>+150 ms</td><td>1</td></tr>
  <tr><td>region3</td><td>:8083</td><td>:7073</td><td>+250 ms</td><td>1</td></tr>
  <tr><td>region4</td><td>:8084</td><td>:7074</td><td>+200 ms</td><td>1</td></tr>
  <tr><td>region5</td><td>:8085</td><td>:7075</td><td>+300 ms</td><td>1</td></tr>
</table>

<div class="caption">Toxiproxy adds real network latency between the global load balancer and regions 2–5. The local region gets most writes.</div>

Notes:
18:15 (0:35)
- Five regions. Each has its own app and its own grid, and Toxiproxy puts each one a different distance away.
- region1 is the fast local region, so it has a high weight and takes most of the writes. The rest are the slow, remote regions.
- We're going to kill region1 and watch the writes spread to the slow ones.

---

<!-- .slide: data-terminal data-command="writes 12" -->

## The baseline

<div class="frame shell"><pre><code class="bash"># started before the talk: five regions + monitoring
$ ./world up
</code></pre></div>

<div class="caption">Live dashboard → http://localhost:8080/ &nbsp; Grafana → http://localhost:3000</div>

<div class="fallback">
<div class="caption">Illustrative output (not live)</div>
<table class="data">
  <tr><th>region</th><th>health</th><th>writes</th><th>avg</th><th>distance</th></tr>
  <tr><td class="up">region1</td><td class="up">UP</td><td>10</td><td class="up">10 ms</td><td>local</td></tr>
  <tr><td class="up">region2</td><td class="up">UP</td><td>1</td><td>174 ms</td><td>+150 ms</td></tr>
  <tr><td class="up">region3</td><td class="up">UP</td><td>1</td><td>269 ms</td><td>+250 ms</td></tr>
  <tr><td class="up">TOTAL</td><td></td><td>12 writes</td><td class="up">45 ms</td><td></td></tr>
</table>
</div>

Notes:
18:50 (1:30)
- One command. Pre-flight, build, five regions, monitoring, app. About 80 seconds cold, so I ran it before you sat down.
- Before Enter: watch the succeeded / attempted / failed total, the serving regions, and latency. Most baseline writes should land on region1.
- LIVE: press Enter to send twelve real writes through the gateway. Read the actual result; if any fail, say so.
- Every write goes to one URL: the global load balancer. It picks the region; the app in that region writes to its local grid.
- Watch the counts and the latency: most writes land on region1, the local region, in about 10 ms. The few that land far away take 150 to 300 ms. That's Toxiproxy, real network delay.
- Normal operation. Everything is up, everything is fast. Now the fun part.
- No live terminal? The table on the slide is the fallback.

---

<!-- .slide: data-terminal data-command="./world region-destroy 1 && writes 6" -->

## Kill the fast region

<div class="frame shell"><pre><code class="bash"># one command, one region, right now
$ ./world region-destroy 1
</code></pre></div>

<div class="fallback">
<div class="caption">Illustrative output (not live)</div>
<pre><code class="plaintext">#### Writing 6 accounts - live traffic
  region2       2 writes   avg latency  173 ms
  region3       1 writes   avg latency  269 ms
  region4       1 writes   avg latency  225 ms
  region5       2 writes   avg latency  315 ms
  TOTAL       6 succeeded / 6 attempted; 0 failed or unverified
</code></pre>
</div>

<div class="caption">Watch the result: successful writes, failures, and the regions serving them.</div>

Notes:
20:20 (2:00)
- Before Enter: region1 carries most baseline traffic. We will stop its app and grid, then send six writes. Watch whether those writes succeed and which surviving regions serve them.
- LIVE: press Enter. We deliberately choose region1 so the latency difference is visible.
- The gateway retries selected failures while health checks remove the stopped region. This batch runs after the stop command completes; it does not by itself prove that a request in flight at the instant of failure succeeded.
- Read the succeeded / attempted / failed total. Describe what happened in this batch, including any failed or unverified requests.

---

<!-- .slide: data-terminal data-command="writes 12 && ./world recovery-mark 1" -->

## Degraded, but alive

<div class="fallback">
<div class="caption">Illustrative output (not live)</div>
<table class="data">
  <tr><th>region</th><th>health</th><th>writes</th><th>avg</th><th>distance</th></tr>
  <tr><td class="down">region1</td><td class="down">DOWN</td><td>0</td><td class="muted">--</td><td>local</td></tr>
  <tr><td class="up">region2</td><td class="up">UP</td><td>2</td><td>159 ms</td><td>+150 ms</td></tr>
  <tr><td class="up">region3</td><td class="up">UP</td><td>3</td><td>265 ms</td><td>+250 ms</td></tr>
  <tr><td class="up">region4</td><td class="up">UP</td><td>5</td><td>214 ms</td><td>+200 ms</td></tr>
  <tr><td class="up">region5</td><td class="up">UP</td><td>2</td><td>314 ms</td><td>+300 ms</td></tr>
  <tr><td class="up">TOTAL</td><td></td><td>12 writes</td><td class="up">234 ms</td><td></td></tr>
</table>
</div>

<div class="big sub">Latency went up. These writes <span class="accent">still succeeded</span>.</div>

Notes:
22:20 (1:00)
- Before Enter: look for twelve successful writes on regions 2–5 at higher latency. Then we will create a new account while region1 is confirmed DOWN.
- LIVE: press Enter. The command runs `writes 12 && ./world recovery-mark 1`. Read out the fresh account ID and the surviving region that accepted it. We will look for that exact account on region1 after restoration.
- The cost of losing the fast region: it's slower.
- Writes now land on the farther regions, so average latency climbs to a few hundred milliseconds.
- Be precise about what changed: the global load balancer is sending users to a region farther away. Every request is still served by a region that reads and writes its own local grid. No app is calling across regions; that anti-pattern never came back.
- These sampled writes succeeded while region1 was down. That is the evidence for this failure scenario. The next question is whether region1 can recover the data it missed.

---

<!-- .slide: data-terminal data-command="./world region-restore 1" -->

## Bring the region back

<div class="frame shell"><pre><code class="bash"># restart region1; verify data catch-up separately
$ ./world region-restore 1
</code></pre></div>

<div class="fallback">
<div class="caption">Illustrative output (not live)</div>
<pre><code class="plaintext">[OK] region1 Account region is writable again
[OK] region1 ready on :8081
[OK] Global LB sees region1 UP
[OK] Restored: region1
</code></pre>
</div>

<div class="caption">Start the restore, then advance. Keep watching the terminal for region1 UP.</div>

Notes:
23:20 (0:30)
- Before Enter: watch the grid start, then the app, then the gateway report UP. Health and data catch-up are separate checks.
- LIVE: press Enter once to start ./world region-restore 1, then advance immediately with the arrow key or clicker. The restore keeps running in the same terminal under the next four slides.
- While region1 comes back, explain what NOT to do: introduce a synchronous data dependency on another geographic region.
- Look for "Global LB sees region1 UP" and "Restored: region1" in the terminal. UP means it is back in traffic rotation; our later recovery-check verifies the outage account separately.
- If restore stalls, stay on the explanation slides. Ctrl+C stops it if needed; describe what remains unverified.
