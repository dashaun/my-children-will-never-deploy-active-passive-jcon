<!-- .slide: data-terminal -->

## The cross-region data call

<p class="lead">What NOT to do when a region goes down</p>

<div class="frame"><pre><code class="java">// local app now depends on a remote region's data
var account = remoteRegion.findById(id);
</code></pre></div>

<div class="big sub">A remote data call couples <span class="warn">both regions' fate</span>.</div>

Notes:
23:50 (0:50)
- The restore is still running below. Advance with the arrows or clicker; these slides do not type into the shell.
- This is the trap: keep the app local, but make its data call cross into another geographic region when a region fails. The code is illustrative pseudocode.
- You have added a synchronous dependency to the request path. If the remote region is slow or unavailable, the local request waits, retries, or fails too.
- That differs from our gateway routing a whole request to a healthy region. There, the destination app still reads and writes its own local grid.

---

<!-- .slide: data-terminal -->

## The latency math

<div class="frame"><pre><code class="plaintext">request time = local work + remote round trip
# repeated remote calls add repeated network waits
# timeouts and retries can extend the wait further
</code></pre></div>

<div class="big sub">Latency is the <span class="warn">new downtime</span>.</div>

Notes:
24:40 (0:55)
- Keep an eye on region1's startup output below as we talk.
- The request now waits for a remote round trip on top of its local work. Multiple sequential remote calls repeat that wait; timeouts and retries can extend it further.
- In our demo, routing to a farther region increases client latency. That is different from adding a cross-region data round trip inside every request.
- A successful response can still miss the user's latency budget. This is why we keep data access local to the serving region.

---

<!-- .slide: data-terminal -->

## The data-layer tradeoff

<div class="cols">
  <div class="col amber">
    <h3>Remote data calls</h3>
    <ul>
      <li>Wait on another region</li>
      <li>Share its failure behavior</li>
    </ul>
  </div>
  <div class="col teal">
    <h3>Local data + replication</h3>
    <ul>
      <li>Remote copies can lag</li>
      <li>Conflicts need business rules</li>
    </ul>
  </div>
</div>

Notes:
25:35 (0:45)
- Owning the data locally removes that synchronous regional dependency. Asynchronous replication brings different tradeoffs: stale reads and conflicting writes.
- If region2 changes a balance from 100 to 90, region3 can still read 100 until replication arrives. If region3 also writes 80, converging to one value does not preserve both intended withdrawals.
- A business rule may require a single writer per account or coordination to preserve the invariant. This demo replaces whole account values; it does not prove financial correctness or implement a custom business conflict resolver.
- Watch the terminal for region1's return to traffic rotation. That alone does not prove its data caught up.

---

<!-- .slide: data-terminal -->

<div class="big">The rule:<br/>Data is <span class="accent">managed locally</span>,<br/>replicated <span class="accent">asynchronously</span>.</div>

<div class="caption">Route the request to a healthy region. Keep its data access local.</div>

Notes:
26:20 (0:25)
- Our rule is to route a request to a healthy region whose app reads and writes its own local data. Replication happens in the background.
- Before advancing: wait for "Global LB sees region1 UP" and "Restored: region1", then a returned shell prompt. Do not queue the next command while restore is running.
- The next slide sends fresh traffic; the slide after that checks the exact outage account directly on region1. Healthy traffic and data catch-up are separate evidence.
- If restoration has not completed, stay here and use the consistency example from the previous slide. If it fails, explain what remains unverified rather than presenting fallback output as live evidence.
