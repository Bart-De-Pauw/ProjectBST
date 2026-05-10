---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when the user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

# Grill me

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.

## Operating procedure

### Setup (only once)
- Ask for the plan/design text if it hasn’t been provided.
- Extract the top-level goal, constraints, stakeholders, and success criteria.
- Identify major decision areas (architecture, data model, APIs, UX, perf, security, rollout, testing, ops).

### The grilling loop (repeat)
1. Choose the **highest-leverage unresolved decision** (prefer prerequisites before dependents).
2. If the question is answerable by codebase inspection, **inspect the codebase instead** and then proceed.
3. Ask **one** crisp question.
4. Immediately provide:
   - **Recommended answer** (a default choice)
   - **Why** (1–3 key reasons)
   - **Key trade-off / risk** (what you give up)
   - **Follow-up question** (only if needed; still one question total per turn)
5. Update the decision tree mentally and continue down the same branch until it is resolved.

### Guardrails
- Ask one question per assistant turn. Do not bundle multiple questions.
- Prefer concrete options with a default recommendation.
- Don’t let the user hand-wave: request specifics (numbers, limits, SLAs, exact interfaces) when ambiguity blocks decisions.
- Keep going until the plan is internally consistent (no unresolved prerequisites, no conflicting constraints).

## Example turn format
**Question**: <one question>

**Recommended answer**: <your recommendation>

**Why**:
- <reason 1>
- <reason 2>

**Trade-off / risk**: <main downside>
