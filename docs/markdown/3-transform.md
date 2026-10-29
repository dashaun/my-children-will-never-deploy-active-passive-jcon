## Single region → multi-region active-active

<div class="cols">
  <div class="col red">
    <h3>Before</h3>
    <ul>
      <li>One app, one data grid, one region</li>
      <li>App reads and writes its own local grid</li>
      <li>All eggs in one basket</li>
    </ul>
  </div>
  <div class="col teal">
    <h3>After</h3>
    <ul>
      <li>The same app, deployed in five regions</li>
      <li>Each still reads and writes only its local grid</li>
      <li>WAN replication between the grids</li>
      <li>A global load balancer in front</li>
    </ul>
  </div>
</div>

Notes:
8:20 (0:40)
- Here's the transformation. One region, one center of gravity.
- We turn it into five equal regions. Same app in each, each owning its own local writes.
- Replication moves in the background over the WAN. A global load balancer decides which region serves each request.

---

## The same app, configured per region

<div class="stack">
<div class="frame shell"><pre><code class="properties"># before: one region
server.port=8080
region.name=region1
region.gemfire-url=http://localhost:7071
</code></pre></div>
<div class="frame shell"><pre><code class="bash"># after: the same jar, once per region
$ java -jar publish.jar \
    --server.port=8081 \
    --region.name=region1 \
    --region.gemfire-url=http://localhost:7071
# … region2-5: 8082-8085 → 7072-7075
</code></pre></div>
</div>

<div class="caption">The app never learned about other regions. It still talks only to its local grid.</div>

Notes:
9:00 (0:50)
- For this prepared app, deployment changes are configuration. The same jar starts once per region. An existing app may still need changes to its data model and consistency assumptions.
- No new code paths, no region-aware repository, no cross-region client. Each copy only knows its own grid.
- Everything multi-region lives below the app, in WAN replication, and above it, in the global load balancer.

---

## Five active regions

<img class="clean" src="images/active-active.svg" style="width:auto;height:470px;max-width:100%" alt="A global load balancer routes traffic to five active regions. Each region has its own app and local data. Asynchronous replication connects the peers.">

<div class="caption">Each app reads and writes locally. WAN replication connects the grids.</div>

Notes:
9:50 (0:45)
- Picture this. Callers hit one URL: the global load balancer. On stage that's Spring Cloud Gateway.
- Behind it, five regions. Each is the same Spring Boot app plus its own GemFire cluster, and the clusters replicate over the WAN.
- Everything runs on this laptop, so Toxiproxy adds real network latency to regions 2 through 5. region1 is the local, fast one.

---

## This is not hypothetical

<div class="cols">
  <div class="col teal">
    <h3>The real production shape</h3>
    <ul>
      <li>The same Spring Boot app in every region</li>
      <li>Active-active data store per region</li>
      <li>Replicates over the WAN in the background</li>
      <li>Geo-DNS or a global load balancer</li>
    </ul>
  </div>
  <div class="col amber">
    <h3>On this stage</h3>
    <ul>
      <li>Spring Cloud Gateway plays the global LB</li>
      <li>Weights stand in for "nearest region"</li>
      <li>Health checks pick the survivors</li>
      <li>Toxiproxy stands in for distance</li>
    </ul>
  </div>
</div>

Notes:
10:35 (0:55)
- I've delivered this for real. Spring Boot + an active-active data store + a global load balancer in front.
- In production that front door is geo-DNS or a global load balancer: each region is its own live endpoint, and users land on the closest one.
- On stage, Spring Cloud Gateway plays that role. Weights stand in for proximity, health checks drop a dead region, and Toxiproxy fakes the distance.
- Same pattern, whatever the data store. In this talk it's GemFire, but the shape is identical with Redis Enterprise or any active-active grid.

---

## Account data in every region

<div class="frame shell"><pre><code class="bash"># same logical "Account" region on every cluster
$ gfsh -e "create region --name=Account \
             --type=PARTITION \
             --gateway-sender-id=Account_Sender_to_2,\
               Account_Sender_to_3,\
               Account_Sender_to_4,\
               Account_Sender_to_5"
</code></pre></div>

<div class="caption">Local writes first. Remote copies follow asynchronously.</div>

Notes:
11:30 (0:50)
- The data layer: one logical region, `Account`, exists on every cluster.
- Each cluster creates gateway senders to the other four. So when it gets a write, it ships it across the WAN.
- Writes land locally first (fast), then replicate. Reads and writes are always local.

---

## Replication with WAN gateways

<div class="split">
<div class="frame shell"><pre><code class="bash">gfsh> create gateway-sender \
  --id=Account_Sender_to_2 \
  --parallel=true \
  --remote-distributed-system-id=2 \
  --enable-persistence=true \
  --enable-batch-conflation=true
</code></pre></div>
<div class="col teal">
  <h3>What each flag buys</h3>
  <ul>
    <li><code>parallel</code>: every server ships its own slice</li>
    <li><code>persistence</code>: survive a sender restart</li>
    <li><code>batch-conflation</code>: only the latest update per key crosses the WAN</li>
  </ul>
</div>
</div>

Notes:
12:20 (0:55)
- WAN gateways are how GemFire moves data between clusters.
- Parallel means each server sends its own slices, no bottleneck.
- Persistence means a sender restart doesn't lose queued updates.
- Batch conflation means if you write the same key five times in a second, only the last value goes across. On a hot key, that cuts WAN traffic dramatically.

---

## Global routing with Spring Cloud Gateway

<div class="frame"><pre><code class="yaml">spring.cloud.discovery.client.simple.instances.regions:
  - uri: http://localhost:8081              # region1, local
    metadata: { region: region1, weight: "10" }
  - uri: http://localhost:18082             # region2, via Toxiproxy
    metadata: { region: region2, weight: "1" }
  # … region3-5
spring.cloud.gateway.server.webflux.routes:
  - id: regions
    uri: lb://regions                       # weighted, health-checked
    predicates: [ "Path=/account/**" ]
</code></pre></div>

<div class="caption">region1 has weight 10; the other four have weight 1. All five serve traffic.</div>

Notes:
13:15 (0:55)
- Here's the whole global load balancer. Five instances of one service, "regions", each with a weight.
- region1 is the closest, so it carries most traffic. The other four are farther away but fully live.
- The route sends /account to lb://regions: Spring Cloud LoadBalancer picks the region, weighted, and only among healthy ones.

---

## The health check that decides who serves

<div class="split fit">
<div class="frame"><pre><code class="java">// in every region's app
public Health health() {
  try {
    restClient.get().uri("/gemfire-api/v1/ping")
      .retrieve().toBodilessEntity();
    return Health.up().build();
  }
  catch (Exception e) {
    return Health.down().withException(e).build();
  }
}
</code></pre></div>
<div class="frame"><pre><code class="yaml"># in the global load balancer
spring.cloud.loadbalancer:
  health-check:
    interval: 1s
    path.default: /actuator/health
</code></pre></div>
</div>

<div class="caption">Health checks run every second. Unhealthy regions leave rotation automatically.</div>

Notes:
14:10 (0:50)
- Two halves. Each region's app reports healthy only while its own GemFire answers. That's GemFireHealthIndicator in the repo, trimmed to fit.
- The global load balancer checks every region's /actuator/health every second. Detection also takes probe time. An UP result puts a region back in rotation, but does not prove its data has caught up.
- That's the active-active equivalent of failover, except it's continuous and automatic, not a runbook.

---

## The failover: retry in another region

<div class="frame"><pre><code class="yaml">filters:
  - name: Retry
    args:
      retries: 5
      methods: GET,POST,PUT
      statuses: BAD_GATEWAY,SERVICE_UNAVAILABLE,GATEWAY_TIMEOUT
      backoff: { firstBackoff: 200ms, maxBackoff: 2s, factor: 2 }
</code></pre></div>

<div class="big sub">Retries give a failed request <span class="accent">another chance</span>.<br/>Success still needs a healthy region and time.</div>

Notes:
15:00 (1:15)
- Before health checks notice, a request can still land on a dead region. The gateway retries selected failures, up to five times. A new selection can still pick the same region until health checks remove it.
- A retry can exhaust its attempts or the caller's deadline. This demo tests one region stopping while the others stay reachable. It does not guarantee every request succeeds under every failure.
- What if the write committed but its response was lost? The retry can apply it twice. Here, the caller supplies the account ID and the app PUTs the same full value to that key. Repeating that replacement avoids creating a second account in this example.
- That is not exactly-once delivery. Concurrent edits to the same account still need a conflict policy. Payments, emails, and other side effects need their own idempotency strategy.

---

<div class="big">Active-active is a <span class="accent">data-layer decision</span>.<br/>Own locally, replicate in the background,<br/>balance globally, and fail over automatically.</div>

Notes:
16:15 (0:30)
- So the recipe: own the data locally, replicate in the background, balance at the global load balancer, and let the health check retire a dead region.
- Now let's prove it with a live region kill.
