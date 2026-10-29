(() => {
  "use strict";

  const POLL_MS = 500;
  const HISTORY = 90;
  const FEED_MAX = 60;

  const PALETTE = [
    "oklch(0.82 0.13 82)",   // accent amber (region1 / fast)
    "oklch(0.76 0.1 195)",   // teal
    "oklch(0.72 0.11 285)",  // violet
    "oklch(0.74 0.13 150)",  // green
    "oklch(0.8 0.12 20)",    // coral
  ];

  const els = {
    conn: document.getElementById("conn"),
    connLabel: document.getElementById("conn-label"),
    mode: document.getElementById("mode"),
    modeValue: document.getElementById("mode-value"),
    sumWrites: document.getElementById("sum-writes"),
    sumLatency: document.getElementById("sum-latency"),
    sumFast: document.getElementById("sum-fast"),
    sumEvent: document.getElementById("sum-event"),
    regions: document.getElementById("regions"),
    dist: document.getElementById("dist"),
    legend: document.getElementById("legend"),
    feed: document.getElementById("feed"),
    latency: document.getElementById("latency"),
  };

  let regionColors = {};
  let history = [];
  let lastEventCount = 0;
  let lastRender = null;

  const fmtTime = (ts) => {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  const fmtEvent = (e) => {
    if (e.type === "FAILOVER") return `retry in ${e.latencyMs}ms`;
    if (e.type === "WRITE") return `${e.latencyMs}ms`;
    return "";
  };

  const paintSpark = (canvas, values, color) => {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 180;
    const h = 34;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const data = values.slice(-60);
    if (data.length < 2) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    const max = Math.max(...data, 1);
    const step = w / (data.length - 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i * step;
      const y = h - 3 - (v / max) * (h - 8);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  const renderRegion = (r) => {
    let card = document.getElementById(`region-${r.name}`);
    const color = regionColors[r.name];
    if (!card) {
      card = document.createElement("article");
      card.className = "region";
      card.id = `region-${r.name}`;
      card.innerHTML = `
        <div class="region-head">
          <span class="region-name"></span>
          <span class="status"></span>
        </div>
        <div class="region-meta">
          <span>lat <b class="meta-lat"></b></span>
          <span>wt <b class="meta-wt"></b></span>
        </div>
        <div class="region-writes"><span class="n"></span> <span class="unit">writes</span></div>
        <canvas class="spark"></canvas>`;
      els.regions.appendChild(card);
    }
    card.querySelector(".region-name").textContent = r.name;
    const status = card.querySelector(".status");
    status.className = "status " + (r.healthy ? "up" : "down");
    status.textContent = r.healthy ? "UP" : "DOWN";
    card.querySelector(".meta-lat").textContent = r.latencyMs + "ms";
    card.querySelector(".meta-wt").textContent = r.weight;
    card.querySelector(".n").textContent = r.writes;
    card.classList.toggle("down", !r.healthy);
    paintSpark(card.querySelector(".spark"), r.recent || [], color);
  };

  const renderDistribution = (regions) => {
    const max = Math.max(1, ...regions.map((r) => r.writes));
    const leader = regions.reduce((a, b) => (b.writes > a.writes ? b : a), regions[0]);
    els.dist.innerHTML = "";
    for (const r of regions) {
      const row = document.createElement("div");
      row.className = "dist-row" + (r === leader && r.writes > 0 ? " leader" : "");
      const pct = (r.writes / max) * 100;
      row.innerHTML = `
        <span class="name">${r.name}</span>
        <span class="bar"><i style="width:${pct}%"></i></span>
        <span class="val">${r.writes}</span>`;
      els.dist.appendChild(row);
    }
    if (leader) {
      regionColors[leader.name] = PALETTE[0];
    }
  };

  const renderLatencyChart = (regions) => {
    const canvas = els.latency;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 640;
    const h = 240;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const padL = 44, padR = 10, padT = 12, padB = 24;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const sample = (r) => {
      const recent = r.recent || [];
      return recent.length ? recent[recent.length - 1] : 0;
    };

    const now = Date.now();
    history.push({ t: now, values: Object.fromEntries(regions.map((r) => [r.name, sample(r)])) });
    if (history.length > HISTORY) history.shift();

    let maxLat = Math.max(10, ...history.map((p) => Math.max(...Object.values(p.values), 1)));
    maxLat = Math.ceil(maxLat / 50) * 50;

    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "oklch(0.62 0.02 65)";
    for (let i = 0; i <= 3; i++) {
      const v = (maxLat / 3) * i;
      const y = padT + plotH - (v / maxLat) * plotH;
      ctx.strokeStyle = "oklch(0.32 0.02 65)";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillText(Math.round(v) + "ms", 4, y + 3);
    }

    for (const r of regions) {
      const color = regionColors[r.name];
      ctx.strokeStyle = color;
      ctx.lineWidth = r.healthy ? 1.8 : 1;
      ctx.globalAlpha = r.healthy ? 1 : 0.4;
      ctx.beginPath();
      history.forEach((p, i) => {
        const x = padL + (i / (HISTORY - 1)) * plotW;
        const v = p.values[r.name] || 0;
        const y = padT + plotH - (v / maxLat) * plotH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  const renderLegend = (regions) => {
    els.legend.innerHTML = "";
    for (const r of regions) {
      const s = document.createElement("span");
      s.innerHTML = `<i style="background:${regionColors[r.name]}"></i>${r.name}`;
      els.legend.appendChild(s);
    }
  };

  const renderFeed = (events) => {
    if (events.length < lastEventCount || (lastEventCount > 0 && events.length === 0)) {
      els.feed.innerHTML = "";
      lastEventCount = 0;
    }
    const fresh = events.slice(lastEventCount);
    lastEventCount = events.length;
    for (let i = fresh.length - 1; i >= 0; i--) {
      const e = fresh[i];
      const li = document.createElement("li");
      const cls = e.type === "DOWN" ? "down" : e.type === "UP" ? "up" : e.type === "FAILOVER" ? "failover" : "wr";
      li.className = cls;
      li.innerHTML = `
        <span class="t">${fmtTime(e.ts)}</span>
        <span class="r">${e.region}</span>
        <span class="type">${e.type}</span>
        <span class="m">${fmtEvent(e)}</span>`;
      els.feed.prepend(li);
    }
    while (els.feed.children.length > FEED_MAX) {
      els.feed.lastChild.remove();
    }
    if (fresh.length) {
      els.feed.scrollTop = 0;
    }
  };

  const render = (d) => {
    const regions = d.regions;
    for (const r of regions) {
      if (!(r.name in regionColors)) {
        regionColors[r.name] = PALETTE[regions.indexOf(r) % PALETTE.length];
      }
    }
    const leader = regions.reduce((a, b) => (b.writes > a.writes ? b : a), regions[0]);
    if (leader && leader.writes > 0) {
      regionColors[leader.name] = PALETTE[0];
    }

    for (const r of regions) renderRegion(r);

    els.mode.classList.toggle("normal", d.mode === "NORMAL");
    els.mode.classList.toggle("degraded", d.mode === "DEGRADED");
    els.modeValue.textContent = d.mode;

    els.sumWrites.textContent = d.summary.totalWrites;
    els.sumLatency.textContent = d.summary.avgLatencyMs + " ms";
    const fast = regions.find((r) => r.weight === Math.max(...regions.map((x) => x.weight)));
    els.sumFast.textContent = fast ? fast.name : "—";
    if (d.events.length) {
      const last = d.events[d.events.length - 1];
      els.sumEvent.textContent = `${last.region} ${last.type}${last.latencyMs ? " " + last.latencyMs + "ms" : ""}`;
    }

    renderDistribution(regions);
    renderLatencyChart(regions);
    renderLegend(regions);
    renderFeed(d.events);
  };

  const tick = async () => {
    try {
      const res = await fetch("/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      els.conn.classList.add("live");
      els.connLabel.textContent = "live";
      render(data);
    } catch (e) {
      els.conn.classList.remove("live");
      els.connLabel.textContent = "reconnecting";
    }
  };

  tick();
  setInterval(tick, POLL_MS);
})();
