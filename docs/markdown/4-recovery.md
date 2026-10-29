<!-- .slide: data-terminal data-command="writes 12" -->

## Recovered

<div class="fallback">
<div class="caption">Illustrative output (not live)</div>
<table class="data">
  <tr><th>region</th><th>health</th><th>writes</th><th>avg</th><th>distance</th></tr>
  <tr><td class="up">region1</td><td class="up">UP</td><td>8</td><td class="up">20 ms</td><td>local</td></tr>
  <tr><td class="up">region2</td><td class="up">UP</td><td>1</td><td>172 ms</td><td>+150 ms</td></tr>
  <tr><td class="up">region3</td><td class="up">UP</td><td>0</td><td class="muted">--</td><td>+250 ms</td></tr>
  <tr><td class="up">region4</td><td class="up">UP</td><td>2</td><td>308 ms</td><td>+200 ms</td></tr>
  <tr><td class="up">region5</td><td class="up">UP</td><td>1</td><td>318 ms</td><td>+300 ms</td></tr>
  <tr><td class="up">TOTAL</td><td></td><td>12 writes</td><td class="up">106 ms</td><td></td></tr>
</table>
</div>

<div class="big sub">Lost a region. Kept serving. <span class="accent">Got fast again.</span></div>

Notes:
26:45 (1:00)
- Before Enter: look for successful writes landing on region1 again at lower latency. This checks traffic recovery; the next slide checks data recovery.
- LIVE: press Enter. Twelve writes with region1 back.
- And we're back to normal. Most writes land on region1 again, and average latency drops from a few hundred ms back to tens.
- These batches succeeded before, during, and after this regional stop. Now let's check the data region1 missed.


---

<!-- .slide: data-terminal data-command="./world recovery-check 1" -->

## Did the data come back?

<div class="frame shell"><pre><code class="bash"># read the outage account directly from restored region1
$ ./world recovery-check 1
</code></pre></div>

<div class="caption">Same account ID and value. Local read from region1. No gateway.</div>

<div class="fallback"><pre><code class="plaintext">Illustrative output (not a live result):
[OK] CATCH-UP VERIFIED: region1 has the account created during its outage.
</code></pre></div>

Notes:
27:45 (1:00)
- Before Enter: the account ID must match the one created while region1 was down. The command reads directly from region1's app and checks the ID, name, and balance.
- LIVE: press Enter. It waits briefly for replication and reports success only when the exact account value matches.
- If verified: region1 now has the account created during its outage. We have shown restored traffic and one concrete example of data catch-up.
- If missing or different: say catch-up is not verified. A green health check was not enough. Do not claim recovery from the fallback output.
- One recovered account does not prove every record converged or that conflicting writes preserve business rules. That is what your own recovery checks need to cover.
- Before you copy this, know its limits.
