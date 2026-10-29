# My Children Will Never Deploy Active-Passive

Slides and a working five-region active-active demo from my **JCON USA 2026** session
in Atlanta, for Java and Spring developers and platform engineers building for
availability.

Destroy a region. Keep serving traffic. Bring it back and verify that the data
written during the outage reaches the recovered region.

## Explore the repository

- [Slide deck](docs/) — Reveal.js slides, speaker notes, and local assets.
- [Demo guide](demo/README.md) — setup, architecture, commands, and deterministic ports.
- [Regional Spring Boot application](demo/src/) — reads and writes against its local GemFire cluster.
- [Spring Cloud Gateway and dashboard](demo/gateway/) — routing, health checks, and live traffic visibility.
- [Presentation server](presenter/) — deck with an embedded live terminal.

## The idea

Each region runs the same Spring Boot application and its own GemFire cluster.
Applications access local data; GemFire WAN replication moves data between regions.
Spring Cloud Gateway routes traffic to healthy regional applications, and Toxiproxy
simulates distance to the remote regions.

```text
                         Spring Cloud Gateway :8080
                                    |
                    +---------------+---------------+
                    |               |               |
                 region1         region2    ...  region5
                 Spring Boot     Spring Boot     Spring Boot
                    |               |               |
                 GemFire <------ WAN replication --> GemFire
```

The live sequence demonstrates regional failure, continued service, restoration,
and an explicit data recovery check. WAN replication also introduces consistency
and conflict-resolution tradeoffs: healthy routing alone does not prove data
catch-up, and exhausted retries can still fail. This is a local learning demo;
production deployments require their own security, capacity, and failure testing.

## Try the demo

Clone the repository, then follow the prerequisites below before starting:

```bash
git clone https://github.com/dashaun/my-children-will-never-deploy-active-passive-jcon.git
cd my-children-will-never-deploy-active-passive-jcon
```

## Demo

One command surface in `demo/`:

```bash
cd demo
./world up                 # pre-flight, build, start 5 regions + monitoring + app (~80s)
./world status             # table of regions, health, ports
./world region-destroy 1   # stop region1 live, writes fail over
./world region-restore 1   # rebuild region1, watch it recover
./world demo               # scripted full run with live terminal panel
./world down               # tear it all down (volumes included)
```

See `demo/README.md` for the full command surface, ports, and walkthrough.

## Running the slides and demo

Run the commands below from the repository root unless a step says otherwise.

### Prerequisites

- Docker running with Docker Compose and **at least 12 GiB** allocated to Docker.
- IBM Semeru Java 25 / Eclipse OpenJ9, installed through SDKMAN as `25.0.1.0-sem`. The demo checks this exact installation for builds and application launches.
- Bash 4+ on `PATH` (macOS's bundled Bash 3.2 cannot run the demo). The presentation server prefers `/opt/homebrew/bin/bash` when available.
- Node.js, npm, Python 3, and curl on `PATH`.
- Ports available for the demo and **4173** for the presentation server. See the [demo port list](demo/README.md#ports).

### Install

```bash
sdk install java 25.0.1.0-sem
(cd presenter && npm ci)
(cd demo && ./world pull)
```

The first `./world up` builds the application jars and may download Maven
dependencies. Later runs reuse the jars and local Docker images, so the demo
also works offline after one successful run.

### Start the demo

In one terminal:

```bash
cd demo
./world up
./world status
```

Wait for **World is UP** and confirm the regional apps and gateway are healthy.

### Open the deck with a live terminal

In a second terminal, from the repository root:

```bash
./presenter/run.sh
```

This opens the deck at [localhost:4173](http://localhost:4173/#/) with a live
shell in `demo/` embedded in the demo slides. On each live slide the command is
already typed; press `Enter` to run it.

Useful local pages:

- [Slides](http://localhost:4173/#/)
- [Live demo dashboard](http://localhost:8080/)
- [Grafana](http://localhost:3000/) (`admin` / `admin`)

### The live sequence

Start at **The baseline** ([direct link](http://localhost:4173/#/3/4)) and run
each live slide in order:

| Slide | Command | What to watch |
|---|---|---|
| The baseline | `writes 12` | Successful writes, mostly on fast region1 |
| Kill the fast region | `./world region-destroy 1 && writes 6` | Region1 stops; surviving regions accept writes |
| Degraded, but alive | `writes 12 && ./world recovery-mark 1` | Higher latency, then a fresh account created while region1 is confirmed DOWN |
| Bring the region back | `./world region-restore 1` | Grid and app restart, then the gateway reports region1 UP |
| Recovered | `writes 12` | Traffic returns to region1 and its latency drops |
| Did the data come back? | `./world recovery-check 1` | Exact outage account verified directly on region1, bypassing the gateway |

The restore keeps running while you read the slides that follow it. Wait for
`Global LB sees region1 UP` and `Restored: region1` before running **Recovered**.

Read the **succeeded / attempted / failed or unverified** totals. Failed or
unverified requests return a nonzero result, so a chained command will not run
after a failed batch. A healthy region alone does not prove data recovery; that
is what `recovery-check` verifies.

To repeat, return to **The baseline**. Each `recovery-mark` creates a new account
ID for that run.

You can also run the same steps without the deck, straight from `demo/`. See the
[demo walkthrough](demo/README.md#walkthrough).

### Slides only

To view the deck without Docker or the live terminal, serve `docs/` over HTTP:

```bash
python3 -m http.server 4174 --bind 127.0.0.1 --directory docs
```

Open [localhost:4174](http://localhost:4174/#/). Demo slides show illustrative
output and do not run commands. Serve the deck rather than opening
`docs/index.html` as a local file, because Reveal loads the slide Markdown over HTTP.

### Clean up

Press `Ctrl+C` in the presentation-server terminal, then:

```bash
(cd demo && ./world down)
```

`down` stops the demo processes and containers and removes their Docker volumes,
including the demo data.

## Outline

1. **Why active-passive is the default:** fragility of standby, failover day is the worst day.
2. **Transformation:** single-region Spring Boot app to multi-region: IMDG active-active, WAN replication, Spring Cloud Gateway as the global load balancer, Toxiproxy for distance.
3. **Demo and anti-pattern:** destroy a region, show degraded-but-alive, then restore it. Cross-region data calls, latency, the data tradeoff, and the local-data rule. Verify traffic and data recovery.
4. **Reference architecture recap:** what to copy for your own apps.

## Background

This session builds on the [multi-region active-active demo](https://github.com/dashaun-tanzu/multi-region-active-active-demo)
and the earlier [lightning talk](https://github.com/dashaun/why-my-children-will-never-deploy-active-passive-lightning).
The runnable JCON version is included here in [demo/](demo/).

Find DaShaun at [dashaun.com](https://dashaun.com) or [GitHub](https://github.com/dashaun).
