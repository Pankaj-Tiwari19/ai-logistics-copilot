# AI Logistics Copilot

## Live Demo

**[Try the AI Logistics Copilot](https://ai-logistics-copilot-plum.vercel.app/)**

> Demo journey: Operations → SR-26101 → Understand → Decide → Metrics
> From risk detection to actionable decisions.

An independent Product Management portfolio prototype exploring how AI can help logistics operations teams identify requests at risk, understand why they are at risk, and decide what to do next.

## Product Thesis

For operations teams, detecting a delayed request is only the beginning. The expensive part is the time spent diagnosing the problem and deciding what action to take.

The AI Logistics Copilot compresses that workflow:

**Detect → Understand → Decide → Learn**

AI recommends. The human makes the final decision.

## What This Prototype Demonstrates

- Risk-based operational triage
- Evidence-backed AI explanations
- AI recommendations with alternatives and trade-offs
- Human-in-the-loop decision making
- Override tracking and reason capture
- AI performance measurement, including false negatives
- Graceful degradation when the AI layer is unavailable

## Key Product Decisions

### 1. Priority ≠ Severity

The highest-risk request isn't always the first request an operations manager should work on.

The queue prioritises requests based on factors such as actionability, operational impact and urgency — focusing attention where intervention can still change the outcome.

### 2. Deterministic Where Decisions Are Made

Risk scoring uses transparent, deterministic rules based on observable operational data.

The LLM is used for explanation and recommendation rationale rather than determining the underlying risk score.

This keeps decision-critical logic consistent and auditable.

### 3. AI Recommends — Humans Decide

Each at-risk request provides a primary recommendation and an alternative with trade-offs.

The user can accept a recommendation or override it and provide a reason.

### 4. Decisions Become the Learning Loop

Acceptances and overrides are captured so the product can measure whether recommendations are actually useful.

The metrics view also exposes false negatives rather than showing only successful predictions.

## User Journey

**Detect** → Operations dashboard identifies requests requiring attention.

**Understand** → Request detail shows the underlying evidence and AI-generated explanation.

**Decide** → The operations manager accepts a recommendation or overrides it.

**Learn** → Decision and outcome data feed operational and AI-performance metrics.

## Architecture

The prototype uses three deliberately separated layers:

1. **Synthetic data layer**  
   Fictional carriers and logistics requests provide reproducible demonstration data.

2. **Deterministic risk engine**  
   Observable factors such as expiry pressure, approval delays, event stagnation and carrier history contribute to a risk assessment.

3. **LLM narrative layer**  
   The LLM turns the structured assessment into a natural-language explanation. It does not control the underlying risk score.

The LLM is **never required for the dashboard or risk calculation to function**. A deterministic fallback narrative is available if the AI layer is unavailable.

## Deliberately Out of Scope

This is an MVP portfolio prototype, not a production logistics platform.

It does not include:

- Real customer or operational data
- Production integrations
- GPS tracking
- Automated transporter reassignment
- Authentication or multi-user access
- A production database
- Machine-learned risk prediction
- Notifications or real-time re-scoring

These are deliberate V1 scope decisions.

## Limitations

The risk model currently uses hand-weighted rules rather than historical model training.

The decision log is session-based and resets when the prototype reloads.

The prototype uses synthetic outcomes for demonstrating AI-performance metrics.

A production version would require historical data calibration, persistent decision storage, monitoring, model evaluation and appropriate operational controls.

## Data Disclaimer

**This is an independent portfolio prototype using entirely synthetic data and fictional entities. It does not contain confidential, proprietary, customer, or employer data.**

## About

Built as an independent Product Management portfolio project by **Pankaj Tiwari**, focused on B2B SaaS, supply chain & logistics, technical product management and AI-enabled workflows.

My professional experience includes building and scaling logistics products and shipping AI-enabled document extraction workflows in production.

---

*Portfolio prototype — August 2026*
