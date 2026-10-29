# Multi-Region Active-Active GemFire Demo

A five-region, active-active reference architecture for JCON USA 2026. The same
Spring Boot app runs once per region, and each copy reads and writes only its own
GemFire cluster; the clusters replicate over the WAN. Spring Cloud Gateway sits in
front as the global load balancer (weighted, health-checked, retry), and Toxiproxy
adds real latency to the "remote" regions 2-5. Destroy an entire region live and
the service keeps serving; bring it back and it recovers, fast.

```
callers → Spring Cloud Gateway :8080 → region apps :8081-8085 → GemFire :7071-7075
                                (regions 2-5 via Toxiproxy :18082-18085, +150..300 ms)
```

## Quick start

```bash
cd demo

# Once, with network access:
sdk install java 25.0.1.0-sem
sdk env

./world up        # one command: pre-flight, build, start 5 regions + monitoring + app
./world status    # table of regions, health, ports, and the writer app
./world region-destroy 1     # stop region1 live (writes fail over)
./world recovery-mark 1      # fresh account while region1 is confirmed DOWN
./world region-restore 1     # rebuild region1, watch it recover
./world recovery-check 1     # verify that account directly on restored region1
./world demo      # scripted full run with a live terminal panel
./world down      # tear the whole world down (volumes included)
```

Or use the Makefile:

```bash
make up          # stands everything up
make status
make destroy N=1 # stop region1
make restore N=1 # rebuild region1
make demo
make down
```

## Application runtime

The five regional apps and Spring Cloud Gateway use IBM Semeru Java 25
(`25.0.1.0-sem` in SDKMAN), which includes Eclipse OpenJ9. `world` selects and
checks this JDK for builds and every app launch, including region recovery;
it fails if the JDK is missing or is not Java 25 / OpenJ9. Install it before running
offline. GemFire containers retain their pinned `gemfire/gemfire-all:10.3-jdk25`
image and its bundled runtime.

After changing runtimes, restart the apps with `./world up` so existing JVMs are
replaced. The Java 25 jars do not require recompilation solely for this JVM switch.

## Walkthrough

1. `./world up` — everything comes up in about 1.5 minutes from clean.
2. `./world status` — all five regions UP and writable; the fast region dominates.
3. `./world region-destroy 1` — the local region dies: its app and its grid. The
   gateway uses bounded retries for selected failures and checks health every second.
   Read the actual success/failure totals; exhausted retries can still fail.
4. `./world status` — region1 is DOWN, the rest continue; latency rises, service stays up.
5. `./world recovery-mark 1` — create a fresh account while region1 is down,
   recording the exact value to verify after recovery.
6. `./world region-restore 1` — region1's grid and app come back; the global load
   balancer marks it UP and writes get fast again.
7. `./world recovery-check 1` — read the fresh account created by `recovery-mark 1`
   during the outage, directly from region1. It checks the exact ID and value and
   fails if catch-up cannot be verified. Health alone is not evidence of catch-up.

## Ports

| Purpose | Port |
|---|---|
| Global load balancer (Spring Cloud Gateway) / dashboard | 8080 |
| Regional apps region1-5 | 8081-8085 |
| Toxiproxy API | 8474 |
| Toxiproxy → region2-5 apps | 18082-18085 |
| region1 GemFire REST | 7071 |
| region2 GemFire REST | 7072 |
| region3 GemFire REST | 7073 |
| region4 GemFire REST | 7074 |
| region5 GemFire REST | 7075 |
| Grafana (admin/admin) | 3000 |
| Prometheus | 9090 |
| GemFire management console | 7070 |

## Design notes

- **Offline:** every image is pinned to an exact tag (no `:latest`) and pre-pulled
  ahead of time with `./world pull`; both jars are prebuilt. Pre-flight checks every
  image listed in `docker/*/compose.yaml` and only pulls what is missing. A missing
  GemFire image stops `up`; a missing monitoring image only warns.
- **Memory:** pre-flight refuses to start unless Docker has at least 12 GiB
  (Docker Desktop → Settings → Resources). Five regions need about 9 GiB; with less,
  Docker OOM-kills locators mid-startup.
- **Deterministic ports:** all ports above are fixed.
- **Fast startup:** a clean `up` is ~80 seconds.
- **Clean kill:** `region-destroy` uses `stop`, never `down`, so the shared
  `gemfire-cache` network survives and the other regions are untouched.
- **Idempotent:** `up` and `region-restore` can be re-run safely.

## Layout

```
demo/
├── world            # the one-command surface (bash)
├── Makefile         # convenience wrapper
├── pom.xml          # the regional Spring Boot app (Boot 4.1.1), one copy per region
├── src/             # regional app: local reads/writes + GemFire health indicator
├── gateway/         # Spring Cloud Gateway global load balancer + live dashboard
│                    #   (Boot 4.0.9 / Spring Cloud 2025.1.4: 2026.0 for Boot 4.1 is RC)
└── docker/
    ├── region1/…region5/   # one GemFire cluster each (locator + server + config)
    ├── toxiproxy/          # latency to regions 2-5
    └── monitoring/         # Prometheus + Grafana + GemFire console
```

Based on the [original multi-region active-active demo](https://github.com/dashaun-tanzu/multi-region-active-active-demo).
This repository contains the runnable JCON version. See the [slides](../docs/) and
[instructions for running the slides](../README.md#running-the-slides-and-demo).

## Reading the live results

`writes N` reports succeeded / attempted and failed or unverified requests, and
returns nonzero if any request fails or lacks serving-region/latency evidence.
A timeout may mean the write committed but its response was lost. Do not treat
that result as proof that no data was written. The account ID is supplied by the
caller and repeated requests replace the same value. Other side effects need a
separate idempotency design, and concurrent changes need a business conflict rule.

The deck's static fallback output is illustrative and does not verify a live run.
Run `bash demo/tests/world-reporting.sh` from the repository root to exercise
success, failure, partial-batch reporting, and stale-proof rejection without Docker.
