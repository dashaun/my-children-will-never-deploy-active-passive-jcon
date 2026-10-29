## When to choose active-active

<div class="cols">
  <div class="col red">
    <h3>Keep it simple if</h3>
    <ul>
      <li>You're not already paying for standby</li>
      <li>Data can't be eventually consistent</li>
      <li>You can't run a game day</li>
      <li>One region serves all users well</li>
    </ul>
  </div>
  <div class="col teal">
    <h3>You're ready if</h3>
    <ul>
      <li>You already run a barely-used passive region</li>
      <li>Stale reads and conflict rules fit your app</li>
      <li>You'll actually rehearse the failure</li>
      <li>Customers live in more than one place</li>
    </ul>
  </div>
</div>

Notes:
28:45 (0:50)
- You just watched it work. But active-active is not for everyone.
- If you're not already paying for a standby, don't add complexity to save money you aren't spending.
- If your data can't tolerate even brief inconsistency, or you'd never rehearse the kill, keep it simple.
- But if you already run a passive region that earns nothing, and your customers live in more than one place, then active-active is the right upgrade.

---

## What to copy for your own app

<div class="cols">
  <div class="col teal"><h3>Data layer</h3><ul><li>Read and write local data</li><li>Replicate asynchronously over the WAN</li><li>An explicit conflict policy</li></ul></div>
  <div class="col blue"><h3>Global load balancer</h3><ul><li>Weighted toward the nearest region</li><li>Health-check every region</li><li>Bound retries and make writes safe to repeat</li></ul></div>
  <div class="col amber"><h3>Rehearsal</h3><ul><li>Game-day: kill a region regularly</li><li>Verify recovery, not just failure</li><li>Practice it until it's boring</li></ul></div>
</div>

Notes:
29:35 (0:50)
- If you are ready, here's what to copy.
- Data layer: own it locally, replicate asynchronously, and choose a conflict policy that preserves your business rules.
- In front: a global load balancer that prefers the nearest region, health-checks every region, and uses bounded retries with operations that are safe to repeat. The app itself stays single-region.
- And the part most people skip: rehearse it. Game-day. Kill a region on purpose. Regularly. Until it's boring.

---

## The three takeaways

1. **Active-passive is a daily tax:** standby earns nothing and fails slowly.
2. **Latency is the new downtime:** cross-region calls are the real anti-pattern.
3. **Active-active is a data problem:** own locally, replicate, balance, fail over.

<div class="caption">Choose the consistency model. Rehearse failure and recovery.</div>

Notes:
30:25 (0:55)
- Three things.
- One: active-passive is a tax you pay for capacity you don't use.
- Two: latency is the new downtime, and cross-region calls are how you pay it.
- Three: this is a data-layer decision. Get the data model right, and everything else falls into place.

---

<div class="big" style="font-size:1.35em">If a region can go down,<br/>you should be able to <span class="accent">lose it</span>.</div>

<div style="display:flex; gap:1em; justify-content:center; align-items:center; margin-top:0.6em">
<img class="clean" src="images/repo-qr.svg" alt="QR code for the repo" style="width:5em; height:5em; margin:0">
<div class="frame shell" style="font-size:0.85em"><pre><code class="bash">$ git clone https://github.com/dashaun/\
    my-children-will-never-deploy-active-passive-jcon
$ cd my-children-will-never-deploy-active-passive-jcon/demo
$ ./world up    # the whole world, one command
</code></pre></div>
</div>

Notes:
31:20 (0:50)
- I'll leave you with the line I opened with. If a region can go down, and it will, you should be able to lose it.
- Scan the QR code now. It stays up during questions too.
- All of it is in the repo: slides in docs, the working demo in demo. One command and you have five regions to destroy.
- Take it, adapt it, and stop running a standby. Go home and make sure your children never deploy active-passive either.
