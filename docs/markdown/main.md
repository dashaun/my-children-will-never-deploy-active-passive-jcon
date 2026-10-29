# My Children Will Never Deploy Active-Passive

### DaShaun Carter, Spring Developer Advocate, Broadcom

Notes:
0:00 (0:30)
- The title is a promise, and I intend to keep it. By the end of this talk, you'll see a five-region, active-active system come up, lose an entire region, and keep going.
- Let's get into why this matters.

---

## DaShaun Carter

- <span class="days-since" data-since="2021-12-20">1,700+</span> days as Spring Developer Advocate, Broadcom
    - 411 days as Sr. Partner Solution Architect, Redis <!-- .element: class="fragment" -->
    - 845 days as Sr. Platform Architect, Pivotal/VMware <!-- .element: class="fragment" -->
    - 985 days as VP of Engineering, Mobile Capital Group/MedZero <!-- .element: class="fragment" -->
    - 1995 days as Tech Lead Engineer, Garmin Connect <!-- .element: class="fragment" -->

Notes:
0:30 (0:45)
- I'm DaShaun Carter, Spring Developer Advocate.
- I've done some things. Advance through each one.
- Land on Garmin Connect: I've been on the call when the standby became active at 3am. That's the day you find out whether your failover runbook was ever actually true.

---

<div class="four-up">
  <a class="item" href="https://springofficehours.io">
    <div class="shot"><img src="images/intro/spring-office-hours-blank.png" alt="Spring Office Hours"></div>
    <div class="label">springofficehours.io</div>
  </a>
  <div class="item">
    <div class="shot"><img src="images/intro/aaif-ambassador-2026.png" alt="AAIF Ambassador 2026"></div>
    <div class="label">AAIF Ambassador 2026</div>
  </div>
  <a class="item" href="https://link.springer.com/book/9798868826399">
    <div class="shot"><img src="images/intro/book_cover.jpg" alt="Pro Spring Boot 4"></div>
    <div class="label">Pro Spring Boot 4</div>
  </a>
  <a class="item" href="https://youtube.com/@coffeesoftware">
    <div class="shot"><img src="images/intro/coffeesoftware_banner.jpg" alt="Coffee + Software"></div>
    <div class="label">youtube.com/@coffeesoftware</div>
  </a>
</div>

Notes:
1:15 (0:20)
- Spring Office Hours, the AAIF ambassador program, Pro Spring Boot 4, and Coffee + Software.

---

## Now We Are Connected

<div class="big"><a href="https://dashaun.com">DaShaun.com</a></div>

<div class="caption">Slides, code, events, and every social link live there.</div>

Notes:
1:35 (0:15)
- Everything is at dashaun.com: slides, code, events, socials.

---

<img class="family" src="images/intro/family.jpg" alt="Family Dinner">

Notes:
1:50 (0:15)
- In my house, the kids make their beds, brush their teeth, just say no to Java 8, and they NEVER deploy active-passive.
- Those are the house rules. Let me show you why that last one matters.

---

## Zones and regions

<img class="clean" src="images/zones-and-regions.svg" style="width:1180px;height:auto;max-height:380px" alt="Two geographic regions, each containing three availability zones. Each zone contains one or more datacenters with separate power, cooling, and networking. Low-latency links connect zones within each region. Zone counts are illustrative.">

<div class="big sub">Multiple zones still share <span class="accent">one region</span>.</div>

Notes:
2:05 (0:45)
- A zone is an isolated location with separate power, cooling, and networking. It can contain one or more datacenters.
- The outer boxes are geographic regions; the inner boxes are zones. Three zones is illustrative. Multiple zones help with a zone failure, but they still share a region.
- To survive a whole region becoming unavailable, another region must be able to serve the workload. That is the scope of this talk.
- Terminology: GemFire's Account "region" is a data container, not a geographic location. Our laptop simulates five geographic regions; it does not provide physical isolation.
- Reference: https://dashaun.com/my-children-will-never-deploy-active-passive/#/3/3 (zones-and-regions level set).
- Provider definition: https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html

---

## The default we were taught

<p class="lead">Does this look familiar to you?</p>

<img class="clean" src="images/active-passive.svg" style="width:auto;height:430px;margin-top:0.4em" alt="Active-passive: normal traffic goes to active region 1. Data replicates to standby region 2, with a separate failover route after promotion.">

Notes:
2:50 (0:45)
- Active-passive is the default because it's what we were taught, and what the tools used to force.
- One region takes traffic, the other waits. The standby is insurance you pay for every day and only collect on the worst day.
- The solid line is normal traffic; the dashed line is the failover path. Region 2 has a copy of the data but must be promoted to serve traffic after failure. This is the standby pattern pictured here; active-passive implementations vary.

---

## I have scar tissue

<blockquote>Is your app alone and trembling in a dark,
single-region with failures, latency, and retry
storms closing in on every side?</blockquote>

<div class="caption">That was my app. I was there.</div>

Notes:
3:35 (0:55)
- That was my app. Garmin Connect - millions of users - and I was the one whose phone rang when something went wrong.
- No control over what happened in the datacenter. Just retry storms, latency, and a very demanding on-call pager.
- That scar tissue is why I care about this so much.
- And the most common thing I hear from every team since, is this.

---

<blockquote>"We have never done a game-day exercise."</blockquote>

<div class="big sub"><span class="accent">Test the failover. Test the recovery.</span></div>

Notes:
4:30 (0:35)
- Everyone's runbook includes a failover step. Nobody has actually run it.
- That's the gap. We treat the standby as insurance and never collect on it.
- Today we're going to do a game day, live, on stage. Test the backup. Test the failover. Test the recovery.
- But first, let's understand why active-passive keeps winning the default slot.

---

>The pattern I teach my teams: 
>**If a region can go down, you should be able to lose it.**

<span class="who">DaShaun Carter</span>

Notes:
5:05 (0:20)
- This is the whole talk in one line.
- If a region can go down, and it will, then you should be able to lose it without losing the service.
- That's the bar. Let's find out why the default fails it.

