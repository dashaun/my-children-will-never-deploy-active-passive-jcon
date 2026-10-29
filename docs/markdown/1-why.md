## The pricing of reliability

<div class="cols">
  <div class="col red">
    <h3>You pay for standby</h3>
    <ul>
      <li>Capacity waiting for a failure</li>
      <li>A second deployment to operate</li>
      <li>A failover path to rehearse</li>
    </ul>
  </div>
  <div class="col amber">
    <h3>You pay in latency</h3>
    <ul>
      <li>Distant customers wait longer</li>
      <li>Cross-region calls are slow and fragile</li>
      <li>Distance is a tax on every request</li>
    </ul>
  </div>
</div>

Notes:
5:25 (0:50)
- Active-passive has two hidden costs.
- First, the standby. You bought it, you sized it, you licensed it, and it earns nothing until the worst day.
- Second, latency. If your active region is in us-east and your customer is in Tokyo, they feel every millisecond. The architecture serves you, not your customer.

---

## The standby has a time problem

<div class="stats">
  <div class="stat"><div class="n warn">min</div><div class="l">to fail over</div></div>
  <div class="stat"><div class="n amber">sec</div><div class="l">of tolerance</div></div>
  <div class="stat"><div class="n red">RTO</div><div class="l">you signed</div></div>
</div>

<div class="big sub">Failover is measured in <span class="warn">minutes</span>. Your SLA dies in <span class="warn">seconds</span>.</div>

Notes:
6:15 (0:50)
- Here's the mismatch that makes active-passive unfixable.
- Failover is measured in minutes: detect, decide, run the runbook, flip DNS, hope the standby is actually current.
- But your customers and your SLO measure in seconds. If your error budget is e.g. 99.9%, that's about 43 minutes a month. One bad failover can spend your whole budget.

---

## The runbook meets reality

- Standby was cold, or stale
- Runbook was written, never run
- DNS, certs, secrets, routing: all forgotten
- Your team learned the architecture by failing, on stage

<div class="frame shell" style="margin-top:0.4em"><pre><code class="bash"># the runbook nobody rehearsed
$ ./failover.sh
# ... 40 minutes later ...
$ # did anyone verify the standby's data?</code></pre></div>

Notes:
7:05 (0:50)
- The standby is the least-tested piece of infrastructure you own.
- It's cold, it's stale, the runbook is aspirational.
- On the day you need it, you're not just restarting a service, you're learning your own architecture.

---

<div class="big">Active-passive is a <span class="warn">reserve</span><br/>that only pays out<br/>on the day you <span class="warn">least want</span> it to.</div>

Notes:
7:55 (0:25)
- That's the reality.
- Active-passive is a reserve. Insurance. You buy it to be ready, but collecting is the worst day, and the payout is slow.
- We can do better. Let's build five regions that each serve local traffic, then test losing one.
