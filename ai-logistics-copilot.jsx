import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, CartesianGrid,
} from "recharts";
import {
  Ship, AlertTriangle, Clock, CheckCircle2, XCircle, ArrowLeft,
  Radar, Brain, Gavel, TrendingUp, ChevronRight, Container, FileText,
  Sparkles, WifiOff, User, Building2,
} from "lucide-react";

/* ============================================================
   AI LOGISTICS COPILOT — portfolio prototype
   Thesis: detection is cheap; the ops manager's time is spent on
   diagnose-and-decide. The copilot compresses that. Human decides.
   Layers:
     1. Synthetic data (fictional carriers, seeded generation)
     2. Deterministic risk engine (pure functions, decision-critical)
     3. Optional LLM narrative layer (explanation only, with fallback)
     4. Four screens: Detect → Understand → Decide → Learn
   ============================================================ */

/* ---------- Fixed demo clock (deterministic, stable demo) ---------- */
const NOW = new Date("2026-08-24T09:00:00").getTime();
const H = 3600 * 1000;
const hoursAgo = (h) => NOW - h * H;
const hoursAhead = (h) => NOW + h * H;

/* ---------- Synthetic carriers (fictional) ---------- */
const CARRIERS = {
  MER: { id: "MER", name: "Meridian Line", medianApprovalHrs: 24, delayRate: 0.07 },
  BLW: { id: "BLW", name: "BlueWave Shipping", medianApprovalHrs: 30, delayRate: 0.12 },
  CAS: { id: "CAS", name: "Cascadia Container Line", medianApprovalHrs: 36, delayRate: 0.27 },
  NST: { id: "NST", name: "Northstar Marine", medianApprovalHrs: 20, delayRate: 0.05 },
  PAC: { id: "PAC", name: "Pacific Arc Lines", medianApprovalHrs: 28, delayRate: 0.17 },
};

const STAGES = ["docs_submitted", "carrier_approval", "pickup_scheduled", "in_transit", "delivered"];
const STAGE_LABEL = {
  docs_submitted: "Docs submitted",
  carrier_approval: "Carrier approval",
  pickup_scheduled: "Pickup scheduled",
  in_transit: "In transit",
  delivered: "Delivered",
  closed: "Closed",
};

const ROUTES = [
  ["Nhava Sheva", "ICD Tarapur"], ["Mundra", "Ahmedabad CFS"], ["Nhava Sheva", "Pune ICD"],
  ["Pipavav", "Rajkot CFS"], ["Hazira", "Surat ICD"], ["Mundra", "Jaipur ICD"],
  ["Chennai", "Bengaluru ICD"], ["Nhava Sheva", "Nashik CFS"],
];
const TRANSPORTERS = [
  "Sahyadri Freight Co", "Kutch Cargo Movers", "Trident Haulage", "GreenMile Logistics",
  "Apex Container Carriers", "Shree Ganesh Transport", "Coastal Link Movers",
];

/* ---------- Seeded RNG so the dataset is identical every load ---------- */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260824);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

function makeEvents(req, enteredHrsAgo, lastEventHrsAgo) {
  const evts = [];
  const stageIdx = STAGES.indexOf(req.currentStage);
  let cursor = enteredHrsAgo + stageIdx * 20 + 24;
  evts.push({ ts: hoursAgo(cursor), type: "created", note: "Request created" });
  for (let i = 0; i <= stageIdx; i++) {
    cursor -= 14 + rand() * 10;
    evts.push({ ts: hoursAgo(Math.max(cursor, enteredHrsAgo)), type: "stage_change", note: `Moved to ${STAGE_LABEL[STAGES[i]]}` });
  }
  evts[evts.length - 1].ts = hoursAgo(enteredHrsAgo); // stage entry time
  if (lastEventHrsAgo < enteredHrsAgo) {
    evts.push({ ts: hoursAgo(lastEventHrsAgo), type: "update", note: "Status note added by ops" });
  }
  return evts.sort((a, b) => a.ts - b.ts);
}

let seq = 100;
function mkRequest(over) {
  seq += 1;
  const [origin, destination] = over.route || pick(ROUTES);
  const base = {
    id: `SR-26${seq}`,
    type: pick(["import", "export", "street-turn"]),
    origin, destination,
    carrierId: over.carrierId || pick(Object.keys(CARRIERS)),
    transporter: pick(TRANSPORTERS),
    containerNo: `${pick(["MERU", "BLWU", "CASU", "NSTU", "PACU"])}${Math.floor(1000000 + rand() * 8999999)}`,
    containerType: pick(["20GP", "40GP", "40HC"]),
    teu: pick([1, 1, 2, 2, 3]),
    status: "active",
    ...over,
  };
  base.events = makeEvents(base, over.enteredHrsAgo ?? 12, over.lastEventHrsAgo ?? over.enteredHrsAgo ?? 12);
  base.createdAt = base.events[0].ts;
  return base;
}

/* ---------- Hand-crafted high-signal active requests ---------- */
const CRAFTED = [
  mkRequest({
    carrierId: "CAS", currentStage: "carrier_approval", doExpiryAt: hoursAhead(31),
    enteredHrsAgo: 54, lastEventHrsAgo: 54, route: ["Nhava Sheva", "Pune ICD"], teu: 2,
  }),
  mkRequest({
    carrierId: "BLW", currentStage: "carrier_approval", doExpiryAt: hoursAhead(44),
    enteredHrsAgo: 41, lastEventHrsAgo: 20, route: ["Mundra", "Jaipur ICD"], teu: 3,
  }),
  mkRequest({
    carrierId: "PAC", currentStage: "pickup_scheduled", doExpiryAt: hoursAhead(22),
    enteredHrsAgo: 38, lastEventHrsAgo: 38, route: ["Mundra", "Ahmedabad CFS"], teu: 1,
  }),
  mkRequest({
    carrierId: "MER", currentStage: "pickup_scheduled", doExpiryAt: hoursAhead(46),
    enteredHrsAgo: 40, lastEventHrsAgo: 40, route: ["Hazira", "Surat ICD"], teu: 2,
  }),
  mkRequest({
    carrierId: "CAS", currentStage: "docs_submitted", doExpiryAt: hoursAhead(90),
    enteredHrsAgo: 40, lastEventHrsAgo: 40, route: ["Chennai", "Bengaluru ICD"], teu: 1,
  }),
  mkRequest({
    carrierId: "NST", currentStage: "carrier_approval", doExpiryAt: hoursAhead(150),
    enteredHrsAgo: 10, lastEventHrsAgo: 4, route: ["Pipavav", "Rajkot CFS"], teu: 1,
  }),
  // Breached / unrecoverable: shows actionability logic
  mkRequest({
    carrierId: "PAC", currentStage: "carrier_approval", doExpiryAt: hoursAgo(6),
    enteredHrsAgo: 70, lastEventHrsAgo: 70, route: ["Nhava Sheva", "Nashik CFS"], teu: 1,
  }),
];

/* ---------- Generated fill (healthy-to-medium actives) ---------- */
const GENERATED = Array.from({ length: 23 }, (_, i) => {
  const stage = pick(STAGES.slice(0, 4));
  const drifting = i % 5 === 0; // some requests quietly drift toward risk
  const entered = drifting ? 30 + rand() * 18 : 4 + rand() * 20;
  return mkRequest({
    currentStage: stage,
    doExpiryAt: hoursAhead(drifting ? 60 + rand() * 60 : 96 + rand() * 160),
    enteredHrsAgo: entered,
    lastEventHrsAgo: drifting ? entered : Math.max(2, entered - rand() * 8),
  });
});

/* ---------- Resolved history (powers the Learn screen) ---------- */
function mkResolved(i) {
  const flaggedHigh = i % 3 === 0;
  const breached = flaggedHigh ? i % 6 === 0 : i % 9 === 8;
  const closedDaysAgo = 2 + (i * 2.3) % 40;
  const tatDays = breached ? 4.5 + (i % 3) : 1.6 + (i % 4) * 0.5;
  const r = mkRequest({
    currentStage: "delivered",
    status: "closed",
    doExpiryAt: hoursAgo(closedDaysAgo * 24 + 12),
    enteredHrsAgo: closedDaysAgo * 24 + tatDays * 24,
    lastEventHrsAgo: closedDaysAgo * 24,
  });
  r.closedAt = hoursAgo(closedDaysAgo * 24);
  r.createdAt = r.closedAt - tatDays * 24 * H;
  r.tatDays = tatDays;
  r.flaggedHigh = flaggedHigh;
  r.breached = breached;
  return r;
}
const RESOLVED = Array.from({ length: 18 }, (_, i) => mkResolved(i));

/* ---------- Pre-seeded decision log (so Learn screen has history) ---------- */
const OVERRIDE_REASONS = [
  "Customer asked to hold",
  "Local knowledge: carrier desk closed",
  "Cost of action outweighs risk",
  "Already handled offline",
];
const SEED_DECISIONS = RESOLVED.filter((r) => r.flaggedHigh).map((r, i) => ({
  requestId: r.id,
  action: i % 4 === 0 ? "Own action taken" : "AI primary recommendation",
  wasAI: i % 4 !== 0,
  overrideReason: i % 4 === 0 ? OVERRIDE_REASONS[i % OVERRIDE_REASONS.length] : null,
  decidedAt: r.closedAt - 24 * H,
  seeded: true,
}));

/* ============================================================
   DETERMINISTIC RISK ENGINE (decision-critical layer)
   Pure function: request + carrier + clock → assessment.
   The LLM never participates in scoring.
   ============================================================ */
function assessRisk(req) {
  const carrier = CARRIERS[req.carrierId];
  const reasons = [];
  const hoursToExpiry = Math.round((req.doExpiryAt - NOW) / H);

  // Factor 1 — DO expiry pressure
  let expiryPts = 0;
  if (req.status === "active") {
    if (hoursToExpiry <= 0) expiryPts = 45;
    else if (hoursToExpiry < 24) expiryPts = 40;
    else if (hoursToExpiry < 48) expiryPts = 30;
    else if (hoursToExpiry < 72) expiryPts = 18;
    else if (hoursToExpiry < 120) expiryPts = 8;
  }
  if (expiryPts > 0)
    reasons.push({
      factor: "DO expiry pressure", points: expiryPts,
      evidence: hoursToExpiry <= 0
        ? `DO validity breached ${-hoursToExpiry}h ago`
        : `DO expires in ${hoursToExpiry}h`,
    });

  // Factor 2 — approval stalled vs carrier median
  const stageEntry = req.events.filter((e) => e.type === "stage_change").slice(-1)[0];
  const stageHrs = Math.round((NOW - (stageEntry ? stageEntry.ts : req.createdAt)) / H);
  let approvalPts = 0;
  if (req.currentStage === "carrier_approval") {
    const ratio = stageHrs / carrier.medianApprovalHrs;
    if (ratio >= 1.5) approvalPts = 30;
    else if (ratio >= 1.0) approvalPts = 20;
    else if (ratio >= 0.75) approvalPts = 10;
    if (approvalPts > 0)
      reasons.push({
        factor: "Approval running long", points: approvalPts,
        evidence: `Pending ${stageHrs}h vs ${carrier.name} median ${carrier.medianApprovalHrs}h`,
      });
  }

  // Factor 3 — stage stagnation (no events)
  const lastEvt = req.events[req.events.length - 1];
  const quietHrs = Math.round((NOW - lastEvt.ts) / H);
  let stagPts = 0;
  if (req.status === "active") {
    if (quietHrs >= 36) stagPts = 15;
    else if (quietHrs >= 24) stagPts = 10;
    else if (quietHrs >= 12) stagPts = 5;
  }
  if (stagPts > 0)
    reasons.push({
      factor: "No movement", points: stagPts,
      evidence: `No events for ${quietHrs}h at "${STAGE_LABEL[req.currentStage]}"`,
    });

  // Factor 4 — carrier reliability
  let carrierPts = 0;
  if (carrier.delayRate >= 0.25) carrierPts = 15;
  else if (carrier.delayRate >= 0.15) carrierPts = 10;
  else if (carrier.delayRate >= 0.08) carrierPts = 5;
  if (carrierPts > 0 && req.status === "active")
    reasons.push({
      factor: "Carrier track record", points: carrierPts,
      evidence: `${carrier.name} delayed ${Math.round(carrier.delayRate * 100)}% of requests last quarter`,
    });

  const score = Math.min(100, expiryPts + approvalPts + stagPts + carrierPts);
  const level = score >= 65 ? "high" : score >= 35 ? "medium" : "low";
  reasons.sort((a, b) => b.points - a.points);
  const dominant = reasons[0]?.factor || null;

  // Actionability: can action today still change the outcome?
  const recoverable = hoursToExpiry > 0;
  const actionable = recoverable && score >= 35;

  // Recommendation mapping (from dominant factor pattern)
  let primary = null, alternative = null;
  if (req.status === "active") {
    if (!recoverable) {
      primary = {
        action: "Close out and notify customer of breach",
        tradeoff: "No recovery path remains; fast closure limits detention charges piling further.",
      };
      alternative = {
        action: "Request retroactive DO revalidation from carrier",
        tradeoff: "Occasionally granted, but success is rare and delays honest customer comms.",
      };
    } else if (req.currentStage === "carrier_approval" && reasons.some((r) => r.factor === "Approval running long")) {
      // Stage-aware: if the request is stuck at approval, the unblock action is
      // escalation — even when expiry pressure narrowly out-scores the stall.
      primary = {
        action: `Escalate with ${carrier.name} approvals desk today`,
        tradeoff: "Fastest unblock; spends escalation goodwill with the carrier.",
      };
      alternative = {
        action: "Request DO validity extension",
        tradeoff: "Low friction, but adds ~2 days to TAT and the carrier may decline.",
      };
    } else if (dominant === "DO expiry pressure") {
      primary = {
        action: `Lock pickup slot with ${req.transporter} today`,
        tradeoff: "Protects the deadline; may bump a lower-risk request from today's slots.",
      };
      alternative = {
        action: "Request DO validity extension",
        tradeoff: "Buys ~48h safely, but extensions on this lane are not guaranteed.",
      };
    } else if (dominant === "No movement") {
      primary = {
        action: `Call ${req.transporter} to confirm next milestone`,
        tradeoff: "Cheap and quick; relies on transporter answering promptly.",
      };
      alternative = {
        action: "Reassign to backup transporter",
        tradeoff: "Protects the deadline; mid-request handover adds coordination risk.",
      };
    } else if (dominant === "Carrier track record") {
      primary = {
        action: "Set a 12h proactive follow-up cadence",
        tradeoff: "Low cost; catches slippage early on a historically slow carrier.",
      };
      alternative = {
        action: "Route the next booking on this lane via an alternate carrier",
        tradeoff: "Structural fix, but doesn't change this request's exposure.",
      };
    }
  }

  const impact = 1 + 0.15 * (req.teu - 1);
  const urgency = hoursToExpiry > 0 && hoursToExpiry < 48 ? 1.2 : 1;
  const priority = Math.round(score * (actionable ? 1 : 0.3) * impact * urgency);

  return { score, level, reasons, dominant, hoursToExpiry, stageHrs, quietHrs, recoverable, actionable, primary, alternative, priority };
}

const ACTIVE = [...CRAFTED, ...GENERATED];

/* ============================================================
   LLM NARRATIVE LAYER (explanation only, never scoring)
   ============================================================ */
function fallbackNarrative(req, a) {
  const c = CARRIERS[req.carrierId];
  const parts = a.reasons.map((r) => r.evidence.toLowerCase());
  const why = parts.length
    ? `This request is ${a.level} risk because ${parts.join("; ")}.`
    : `No active risk factors detected; the request is tracking normally.`;
  const rec = a.primary
    ? ` Recommended: ${a.primary.action.toLowerCase()} — ${a.primary.tradeoff.toLowerCase()}`
    : "";
  return { text: why + rec, source: "fallback" };
}

async function llmNarrative(req, a) {
  const c = CARRIERS[req.carrierId];
  const payload = {
    request: { id: req.id, type: req.type, lane: `${req.origin} → ${req.destination}`, stage: STAGE_LABEL[req.currentStage], hoursToExpiry: a.hoursToExpiry, transporter: req.transporter },
    carrier: { name: c.name, medianApprovalHrs: c.medianApprovalHrs, delayRatePct: Math.round(c.delayRate * 100) },
    assessment: { score: a.score, level: a.level, reasons: a.reasons, primary: a.primary, alternative: a.alternative },
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content:
`You are the narrative layer of a logistics risk copilot. Risk scoring is deterministic and already done — do NOT change scores, reasons, or recommendations. Write for a busy operations manager.

Respond ONLY with JSON, no markdown fences, in this shape:
{"explanation": "2-3 sentences: why this request is at risk, citing the concrete evidence numbers", "recommendation_rationale": "1-2 sentences: why the primary action beats the alternative for THIS request"}

Assessment data:
${JSON.stringify(payload)}`,
      }],
    }),
  });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);
  if (!parsed.explanation) throw new Error("bad shape");
  return { text: parsed.explanation, rationale: parsed.recommendation_rationale || "", source: "live" };
}

/* ============================================================
   UI
   ============================================================ */
const T = {
  paper: "#F6F7F5", ink: "#16232E", steel: "#5B6B78", line: "#DDE3E0",
  orange: "#E8622C", orangeSoft: "#FDEDE4", green: "#1F7A5C", greenSoft: "#E4F2EC",
  amber: "#C98A0B", amberSoft: "#FBF1DC", card: "#FFFFFF", inkSoft: "#22384A",
};
const LEVEL_COLOR = { high: T.orange, medium: T.amber, low: T.green };
const LEVEL_SOFT = { high: T.orangeSoft, medium: T.amberSoft, low: T.greenSoft };

const FontLoad = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; }
    ::selection { background:${T.orangeSoft}; }
    .disp { font-family:'Barlow Condensed',sans-serif; letter-spacing:.02em; }
    .mono { font-family:'IBM Plex Mono',monospace; }
    .row-hover { transition: background .12s ease, transform .12s ease; }
    .row-hover:hover { background:#FBFCFA; }
    button { font-family:'IBM Plex Sans',sans-serif; }
    @media (prefers-reduced-motion: reduce) { * { transition:none !important; animation:none !important; } }
  `}</style>
);

function fmtHrs(h) {
  if (h <= 0) return `${-h}h overdue`;
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d ${h % 24}h`;
}
function fmtDate(ts) {
  return new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ---------- The signature: Detect → Understand → Decide → Learn loop bar ---------- */
function LoopBar({ phase }) {
  const phases = [
    { key: "detect", label: "Detect", icon: Radar },
    { key: "understand", label: "Understand", icon: Brain },
    { key: "decide", label: "Decide", icon: Gavel },
    { key: "learn", label: "Learn", icon: TrendingUp },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {phases.map((p, i) => {
        const active = p.key === phase;
        const Icon = p.icon;
        return (
          <React.Fragment key={p.key}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
              borderRadius: 999, fontSize: 12.5, fontWeight: active ? 600 : 500,
              background: active ? T.ink : "transparent",
              color: active ? "#fff" : T.steel,
              border: `1px solid ${active ? T.ink : T.line}`,
            }}>
              <Icon size={13} strokeWidth={2.2} />
              {p.label}
            </div>
            {i < 3 && <ChevronRight size={13} color={T.line} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function RiskBlock({ score, level, size = "md" }) {
  const big = size === "lg";
  return (
    <div className="mono" style={{
      width: big ? 74 : 52, height: big ? 74 : 52, borderRadius: 10,
      background: LEVEL_SOFT[level], color: LEVEL_COLOR[level],
      border: `2px solid ${LEVEL_COLOR[level]}`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontWeight: 600, lineHeight: 1, flexShrink: 0,
    }}>
      <div style={{ fontSize: big ? 27 : 19 }}>{score}</div>
      <div style={{ fontSize: big ? 10 : 8.5, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 3 }}>{level}</div>
    </div>
  );
}

function KPI({ label, value, accent, sub }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "14px 18px", flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 12, color: T.steel, fontWeight: 500 }}>{label}</div>
      <div className="disp" style={{ fontSize: 32, fontWeight: 600, color: accent || T.ink, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.steel, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ---------- Screen 1: Operations dashboard (Detect) ---------- */
function Dashboard({ assessed, decisions, onOpen }) {
  const [filter, setFilter] = useState("all");
  const atRisk = assessed.filter((r) => r.a.level !== "low");
  const actionToday = assessed.filter((r) => r.a.actionable && r.a.hoursToExpiry < 72);
  const decidedIds = new Set(decisions.filter((d) => !d.seeded).map((d) => d.requestId));
  const avgTat = (RESOLVED.reduce((s, r) => s + r.tatDays, 0) / RESOLVED.length).toFixed(1);

  const queue = assessed
    .filter((r) => r.a.level !== "low")
    .filter((r) => (filter === "all" ? true : r.a.level === filter))
    .sort((x, y) => y.a.priority - x.a.priority);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <KPI label="Active requests" value={assessed.length} />
        <KPI label="At risk" value={atRisk.length} accent={T.orange} sub={`${atRisk.filter((r) => r.a.level === "high").length} high · ${atRisk.filter((r) => r.a.level === "medium").length} medium`} />
        <KPI label="Action needed today" value={actionToday.length} accent={T.amber} sub="recoverable within 72h" />
        <KPI label="Avg TAT (closed)" value={`${avgTat}d`} accent={T.green} />
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div>
          <div className="disp" style={{ fontSize: 21, fontWeight: 600 }}>Priority queue</div>
          <div style={{ fontSize: 12.5, color: T.steel }}>
            Sorted by <span className="mono" style={{ fontSize: 11.5 }}>actionability × impact</span> — not raw severity. Unrecoverable requests sink.
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "high", "medium"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: "pointer",
              border: `1px solid ${filter === f ? T.ink : T.line}`,
              background: filter === f ? T.ink : T.card, color: filter === f ? "#fff" : T.steel,
            }}>{f[0].toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
        {queue.map((r, i) => (
          <div key={r.id} className="row-hover" onClick={() => onOpen(r.id)} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", cursor: "pointer",
            borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
            borderLeft: `4px solid ${LEVEL_COLOR[r.a.level]}`,
          }}>
            <RiskBlock score={r.a.score} level={r.a.level} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{r.id}</span>
                <span style={{ fontSize: 13, color: T.inkSoft }}>{r.origin} → {r.destination}</span>
                <span style={{ fontSize: 11.5, color: T.steel, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 6, padding: "1px 7px" }}>{CARRIERS[r.carrierId].name}</span>
                {decidedIds.has(r.id) && (
                  <span style={{ fontSize: 11, color: T.green, background: T.greenSoft, borderRadius: 6, padding: "1px 7px", fontWeight: 600 }}>action logged</span>
                )}
                {!r.a.recoverable && (
                  <span style={{ fontSize: 11, color: T.steel, background: T.paper, border: `1px dashed ${T.line}`, borderRadius: 6, padding: "1px 7px" }}>unrecoverable</span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: T.steel, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.a.reasons[0] ? r.a.reasons[0].evidence : "Tracking normally"}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: r.a.hoursToExpiry < 48 ? T.orange : T.inkSoft, display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                <Clock size={13} /> {fmtHrs(r.a.hoursToExpiry)}
              </div>
              <div style={{ fontSize: 11, color: T.steel, marginTop: 2 }}>to DO expiry</div>
            </div>
            <ChevronRight size={16} color={T.steel} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: T.steel, marginTop: 10 }}>
        {assessed.length - atRisk.length} low-risk requests are tracking normally and stay out of the triage queue.
      </div>
    </div>
  );
}

/* ---------- Stage tracker ---------- */
function StageTracker({ stage }) {
  const idx = STAGES.indexOf(stage);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap", rowGap: 8 }}>
      {STAGES.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
              background: i < idx ? T.green : i === idx ? T.ink : T.card,
              border: `2px solid ${i <= idx ? (i < idx ? T.green : T.ink) : T.line}`,
              color: "#fff", fontSize: 11,
            }}>
              {i < idx ? <CheckCircle2 size={12} /> : <span style={{ color: i === idx ? "#fff" : T.line, fontSize: 10, fontWeight: 700 }}>{i + 1}</span>}
            </div>
            <span style={{ fontSize: 12, fontWeight: i === idx ? 600 : 400, color: i === idx ? T.ink : T.steel }}>{STAGE_LABEL[s]}</span>
          </div>
          {i < STAGES.length - 1 && <div style={{ width: 26, height: 2, background: i < idx ? T.green : T.line, margin: "0 8px" }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------- Screens 2+3: Request detail + AI panel (Understand + Decide) ---------- */
function Detail({ req, a, decisions, onDecide, onBack, setPhase }) {
  const [narrative, setNarrative] = useState(null);
  const [loadingAI, setLoadingAI] = useState(true);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [ovAction, setOvAction] = useState("");
  const [ovReason, setOvReason] = useState(OVERRIDE_REASONS[0]);
  const decision = decisions.find((d) => d.requestId === req.id && !d.seeded);
  const carrier = CARRIERS[req.carrierId];

  useEffect(() => {
    let dead = false;
    setLoadingAI(true);
    setNarrative(null);
    llmNarrative(req, a)
      .then((n) => !dead && setNarrative(n))
      .catch(() => !dead && setNarrative(fallbackNarrative(req, a)))
      .finally(() => !dead && setLoadingAI(false));
    return () => { dead = true; };
  }, [req.id]);

  const decide = (action, wasAI, overrideReason = null) => {
    onDecide({ requestId: req.id, action, wasAI, overrideReason, decidedAt: Date.now() });
    setPhase("decide");
  };

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.steel, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 14, fontWeight: 500 }}>
        <ArrowLeft size={14} /> Back to queue
      </button>

      {/* Request header */}
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <RiskBlock score={a.score} level={a.level} size="lg" />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 17, fontWeight: 600 }}>{req.id}</span>
              <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", color: T.steel, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>{req.type}</span>
            </div>
            <div className="disp" style={{ fontSize: 23, fontWeight: 600, marginTop: 4 }}>{req.origin} → {req.destination}</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 13, color: T.inkSoft }}>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Ship size={14} color={T.steel} /> {carrier.name}</span>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Building2 size={14} color={T.steel} /> {req.transporter}</span>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }} className="mono"><Container size={14} color={T.steel} /> {req.containerNo} · {req.containerType} · {req.teu} TEU</span>
              <span style={{ display: "flex", gap: 6, alignItems: "center", color: a.hoursToExpiry < 48 ? T.orange : T.inkSoft, fontWeight: 600 }}><Clock size={14} /> DO {a.hoursToExpiry <= 0 ? "breached" : "expires"} {fmtHrs(a.hoursToExpiry)}{a.hoursToExpiry > 0 ? "" : ""}</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
          <StageTracker stage={req.currentStage} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* AI risk & action panel */}
        <div style={{ flex: "1.4 1 380px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "13px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={15} color={T.orange} />
              <span className="disp" style={{ fontSize: 17, fontWeight: 600 }}>Risk explanation & recommended action</span>
            </div>
            {loadingAI ? (
              <span style={{ fontSize: 11.5, color: T.steel }}>generating narrative…</span>
            ) : narrative?.source === "live" ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: T.green, background: T.greenSoft, borderRadius: 999, padding: "3px 9px", display: "flex", gap: 5, alignItems: "center" }}><Sparkles size={11} /> Live AI narrative</span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 600, color: T.steel, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 9px", display: "flex", gap: 5, alignItems: "center" }}><WifiOff size={11} /> Standard narrative (LLM offline)</span>
            )}
          </div>

          <div style={{ padding: 18 }}>
            {/* Evidence-backed reasons — deterministic, always shown */}
            <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".08em", color: T.steel, fontWeight: 600, marginBottom: 8 }}>Evidence (deterministic scoring)</div>
            {a.reasons.length === 0 && <div style={{ fontSize: 13.5, color: T.steel }}>No active risk factors. This request is tracking normally.</div>}
            {a.reasons.map((r) => (
              <div key={r.factor} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0", borderBottom: `1px dashed ${T.line}` }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: LEVEL_COLOR[a.level], flexShrink: 0, width: 34 }}>+{r.points}</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.factor}</div>
                  <div style={{ fontSize: 12.5, color: T.steel }}>{r.evidence}</div>
                </div>
              </div>
            ))}

            {/* Narrative */}
            <div style={{ marginTop: 14, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.55, color: T.inkSoft, minHeight: 44 }}>
              {loadingAI ? "Analyzing risk factors…" : narrative?.text}
              {!loadingAI && narrative?.rationale && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: T.steel }}><strong style={{ color: T.inkSoft }}>Why this action:</strong> {narrative.rationale}</div>
              )}
            </div>

            {/* Recommendation + alternative */}
            {a.primary && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".08em", color: T.steel, fontWeight: 600, marginBottom: 8 }}>Your decision</div>

                {decision ? (
                  <div style={{ background: T.greenSoft, border: `1px solid ${T.green}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", color: T.green, fontWeight: 600, fontSize: 13.5 }}>
                      <CheckCircle2 size={16} /> Decision logged
                    </div>
                    <div style={{ fontSize: 13, marginTop: 5, color: T.inkSoft }}>
                      {decision.action}{decision.overrideReason ? ` — override: ${decision.overrideReason}` : ""}
                    </div>
                    <div style={{ fontSize: 11.5, color: T.steel, marginTop: 3 }}>This decision feeds the Learn screen's AI performance metrics.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ border: `2px solid ${T.ink}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.orange, textTransform: "uppercase", letterSpacing: ".07em" }}>Primary recommendation</div>
                          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{a.primary.action}</div>
                          <div style={{ fontSize: 12.5, color: T.steel, marginTop: 3 }}>{a.primary.tradeoff}</div>
                        </div>
                        <button onClick={() => decide(a.primary.action, true)} style={{ background: T.ink, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          Accept
                        </button>
                      </div>
                    </div>

                    {a.alternative && (
                      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T.steel, textTransform: "uppercase", letterSpacing: ".07em" }}>Alternative</div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{a.alternative.action}</div>
                            <div style={{ fontSize: 12.5, color: T.steel, marginTop: 3 }}>{a.alternative.tradeoff}</div>
                          </div>
                          <button onClick={() => decide(a.alternative.action, true)} style={{ background: T.card, color: T.ink, border: `1.5px solid ${T.ink}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            Accept
                          </button>
                        </div>
                      </div>
                    )}

                    {!overrideOpen ? (
                      <button onClick={() => setOverrideOpen(true)} style={{ background: "none", border: `1px dashed ${T.steel}`, color: T.steel, borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", width: "100%" }}>
                        Override — take a different action
                      </button>
                    ) : (
                      <div style={{ border: `1px dashed ${T.steel}`, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.steel, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Your action</div>
                        <input value={ovAction} onChange={(e) => setOvAction(e.target.value)} placeholder="Describe the action you'll take instead"
                          style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${T.line}`, borderRadius: 8, fontFamily: "'IBM Plex Sans',sans-serif" }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.steel, textTransform: "uppercase", letterSpacing: ".07em", margin: "10px 0 6px" }}>Why override the AI?</div>
                        <select value={ovReason} onChange={(e) => setOvReason(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${T.line}`, borderRadius: 8, background: "#fff", fontFamily: "'IBM Plex Sans',sans-serif" }}>
                          {OVERRIDE_REASONS.map((r) => <option key={r}>{r}</option>)}
                        </select>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button disabled={!ovAction.trim()} onClick={() => decide(ovAction.trim(), false, ovReason)}
                            style={{ background: ovAction.trim() ? T.orange : T.line, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: ovAction.trim() ? "pointer" : "default" }}>
                            Log override
                          </button>
                          <button onClick={() => setOverrideOpen(false)} style={{ background: "none", border: "none", color: T.steel, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                        </div>
                        <div style={{ fontSize: 11.5, color: T.steel, marginTop: 8 }}>Override reasons are how the AI learns where it's wrong — they feed the Learn screen.</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Event timeline */}
        <div style={{ flex: "1 1 280px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <FileText size={15} color={T.steel} />
            <span className="disp" style={{ fontSize: 17, fontWeight: 600 }}>Event history</span>
          </div>
          {[...req.events].reverse().map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: `1px dashed ${T.line}`, fontSize: 12.5 }}>
              <span className="mono" style={{ color: T.steel, flexShrink: 0, fontSize: 11.5, width: 96 }}>{fmtDate(e.ts)}</span>
              <span style={{ color: T.inkSoft }}>{e.note}</span>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: T.steel, marginTop: 10 }}>
            Quiet for <strong>{a.quietHrs}h</strong> · at current stage <strong>{a.stageHrs}h</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Screen 4: Metrics (Learn) ---------- */
function Metrics({ assessed, decisions }) {
  const all = decisions;
  const accepted = all.filter((d) => d.wasAI).length;
  const overridden = all.filter((d) => !d.wasAI).length;
  const total = accepted + overridden;
  const acceptRate = total ? Math.round((accepted / total) * 100) : 0;

  const overrideCounts = OVERRIDE_REASONS.map((r) => ({
    reason: r, count: all.filter((d) => d.overrideReason === r).length,
  })).filter((x) => x.count > 0);

  const flaggedHigh = RESOLVED.filter((r) => r.flaggedHigh);
  const highBreached = flaggedHigh.filter((r) => r.breached).length;
  const highSaved = flaggedHigh.length - highBreached;
  const notFlagged = RESOLVED.filter((r) => !r.flaggedHigh);
  const missed = notFlagged.filter((r) => r.breached).length;

  const dist = ["high", "medium", "low"].map((lvl) => ({
    level: lvl[0].toUpperCase() + lvl.slice(1),
    count: assessed.filter((r) => r.a.level === lvl).length,
    fill: LEVEL_COLOR[lvl],
  }));

  const weeks = [5, 4, 3, 2, 1, 0].map((w) => {
    const inWeek = RESOLVED.filter((r) => {
      const d = (NOW - r.closedAt) / (24 * H);
      return d >= w * 7 && d < (w + 1) * 7;
    });
    return {
      week: w === 0 ? "This wk" : `-${w}w`,
      tat: inWeek.length ? +(inWeek.reduce((s, r) => s + r.tatDays, 0) / inWeek.length).toFixed(1) : null,
    };
  });

  const Section = ({ title, sub, children }) => (
    <div style={{ marginBottom: 22 }}>
      <div className="disp" style={{ fontSize: 20, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: T.steel, marginBottom: 12 }}>{sub}</div>
      {children}
    </div>
  );

  return (
    <div>
      <Section title="Operations" sub="How the network is performing">
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Average TAT, closed requests (days)</div>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={weeks} margin={{ top: 6, right: 10, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={T.line} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: T.steel }} axisLine={{ stroke: T.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.steel }} axisLine={false} tickLine={false} domain={[0, 6]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${T.line}` }} />
                <Line type="monotone" dataKey="tat" stroke={T.ink} strokeWidth={2.2} dot={{ r: 3, fill: T.ink }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: "1 1 300px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Active requests by risk level</div>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={dist} margin={{ top: 6, right: 10, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={T.line} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="level" tick={{ fontSize: 11, fill: T.steel }} axisLine={{ stroke: T.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.steel }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${T.line}` }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {dist.map((d) => <Cell key={d.level} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      <Section title="AI performance" sub="Is the copilot earning the team's trust? Every accept and override on the Decide screen lands here.">
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Recommendation acceptance</div>
            <div className="disp" style={{ fontSize: 44, fontWeight: 600, color: T.green, lineHeight: 1.1, marginTop: 6 }}>{acceptRate}%</div>
            <div style={{ fontSize: 12.5, color: T.steel }}>{accepted} accepted · {overridden} overridden ({total} decisions incl. seeded history)</div>
            <div style={{ height: 8, background: T.paper, borderRadius: 99, marginTop: 10, overflow: "hidden", border: `1px solid ${T.line}` }}>
              <div style={{ width: `${acceptRate}%`, height: "100%", background: T.green }} />
            </div>
          </div>

          <div style={{ flex: "1 1 240px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Overrides by reason</div>
            {overrideCounts.length === 0 && <div style={{ fontSize: 12.5, color: T.steel }}>No overrides logged yet. Override a recommendation on any request to populate this.</div>}
            {overrideCounts.map((o) => (
              <div key={o.reason} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: `1px dashed ${T.line}`, fontSize: 12.5 }}>
                <span style={{ color: T.inkSoft }}>{o.reason}</span>
                <span className="mono" style={{ fontWeight: 600 }}>{o.count}</span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: T.steel, marginTop: 8 }}>Override reasons are the roadmap for improving the risk model.</div>
          </div>

          <div style={{ flex: "1 1 240px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Risk prediction vs outcome (closed)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 96, background: T.orangeSoft, borderRadius: 10, padding: "10px 12px" }}>
                <div className="disp" style={{ fontSize: 26, fontWeight: 600, color: T.orange }}>{highBreached}</div>
                <div style={{ fontSize: 11.5, color: T.inkSoft }}>flagged high → breached</div>
              </div>
              <div style={{ flex: 1, minWidth: 96, background: T.greenSoft, borderRadius: 10, padding: "10px 12px" }}>
                <div className="disp" style={{ fontSize: 26, fontWeight: 600, color: T.green }}>{highSaved}</div>
                <div style={{ fontSize: 11.5, color: T.inkSoft }}>flagged high → saved</div>
              </div>
              <div style={{ flex: 1, minWidth: 96, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px" }}>
                <div className="disp" style={{ fontSize: 26, fontWeight: 600, color: T.inkSoft }}>{missed}</div>
                <div style={{ fontSize: 11.5, color: T.inkSoft }}>missed (not flagged, breached)</div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: T.steel, marginTop: 8 }}>"Saved" = flagged high, acted on, delivered on time. Honest scorecard, false negatives included.</div>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ---------- App shell ---------- */
export default function App() {
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [decisions, setDecisions] = useState(SEED_DECISIONS);
  const [phase, setPhase] = useState("detect");

  const assessed = useMemo(() => ACTIVE.map((r) => ({ ...r, a: assessRisk(r) })), []);
  const selected = assessed.find((r) => r.id === selectedId);

  const open = (id) => { setSelectedId(id); setView("detail"); setPhase("understand"); };
  const back = () => { setView("dashboard"); setPhase("detect"); };
  const goMetrics = () => { setView("metrics"); setPhase("learn"); };
  const goDash = () => { setView("dashboard"); setPhase("detect"); };
  const onDecide = (d) => setDecisions((prev) => [...prev, d]);

  return (
    <div style={{ minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <FontLoad />
      {/* Header */}
      <div style={{ background: T.ink, color: "#fff", padding: "14px 22px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: T.orange, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Radar size={19} color="#fff" strokeWidth={2.2} />
            </div>
            <div>
              <div className="disp" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.1 }}>AI Logistics Copilot</div>
              <div style={{ fontSize: 11.5, color: "#9FB0BC" }}>From risk detection to actionable decisions</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={goDash} style={{
              background: view !== "metrics" ? "#fff" : "transparent", color: view !== "metrics" ? T.ink : "#C6D1DA",
              border: "1px solid #3A4E5F", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}>Operations</button>
            <button onClick={goMetrics} style={{
              background: view === "metrics" ? "#fff" : "transparent", color: view === "metrics" ? T.ink : "#C6D1DA",
              border: "1px solid #3A4E5F", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}>Metrics</button>
          </div>
        </div>
      </div>

      {/* Loop bar — the product thesis, always visible */}
      <div style={{ borderBottom: `1px solid ${T.line}`, background: "#FBFCFA", padding: "9px 22px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <LoopBar phase={phase} />
          <div style={{ fontSize: 11.5, color: T.steel, display: "flex", gap: 6, alignItems: "center" }}>
            <User size={12} /> AI recommends · the human decides
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "22px 22px 48px" }}>
        {view === "dashboard" && <Dashboard assessed={assessed} decisions={decisions} onOpen={open} />}
        {view === "detail" && selected && (
          <Detail req={selected} a={selected.a} decisions={decisions} onDecide={onDecide} onBack={back} setPhase={setPhase} />
        )}
        {view === "metrics" && <Metrics assessed={assessed} decisions={decisions} />}
      </div>

      <div style={{ borderTop: `1px solid ${T.line}`, padding: "14px 22px", fontSize: 11.5, color: T.steel }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          Portfolio prototype · entirely synthetic data · fictional carriers · deterministic risk engine, LLM used for narrative only · built by Pankaj Tiwari
        </div>
      </div>
    </div>
  );
}
