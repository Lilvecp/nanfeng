# Jury questions: short answers

The questions a FinTechathon jury is most likely to ask in the Q&A, with the answer we give and where it is proven. Every answer is something the code or the documents already show; nothing here is a promise. Practise them out loud: one or two sentences each, then stop.

## The AI

**If the LLM hallucinates, what happens?**
Nothing moves. The LLM never computes a number and never decides: forecasts come from the Monte Carlo engine, the plan from the MILP optimizer, the permission level from the policy engine, and money only moves after the owner types a one-time code. The agent's explanations ("ask it why") are built from the tools' recorded results, not written by a model. *Proof: [technical documentation](../../01-technical-documentation/technical-documentation.md) sections 3–5; `04-source-code/agent/nanfeng_agent/explain.py`.*

**Why one agent and not a jury of agents that check each other?**
Because a second model checking the first is still AI watching AI. The decisions that matter are taken outside every model: rules a bank can read, and a human with a code. Where a second opinion would help is reading documents (two extractions that must agree), and that is on our roadmap.

**Why didn't you add an LLM classifier to the document guard?**
On purpose: it would be one more component an attacker can talk to. The guard is deterministic rules; it can miss a new wording (known risk K3), which is why nothing depends on it alone: the policy engine and the owner's code stop the money anyway. If we add a classifier, it will only be allowed to raise suspicion, never to clear a document. *Proof: [anti-injection design](../../05-security-self-assessment-report/anti-injection-design.md).*

**Which models do you use, and what does a run cost?**
Mistral OCR reads the document, a small model (Mistral Small) extracts typed fields in quarantine, a strong model (Claude Sonnet) plans, with fallbacks through OpenRouter. The three Cherry Crisis documents cost about USD 0.02 in model calls. Every run has a step cap and a spend cap.

## Security

**What stops a fake invoice from getting paid?**
Four layers, each enough on its own for the money: the guard blocks hidden instructions before any model reads the document; the payee check compares the bank account with the supplier's history; no agent tool accepts a bank account at all; and a new payee or account is level 3, so it needs the owner's code. 46 of 46 red-team attacks are stopped, and CI fails if one gets through. *Proof: [red team report](../../04-source-code/redteam/results/REPORT.md).*

**The one-time code is shown on screen. Isn't that insecure?**
Only in the public demo, so the jury can try it (known risk K2). In SMS mode, which is built and tested, each approval gets a random code bound to its amount, valid 5 minutes, single use, sent to the owner's phone and never seen by the agent.

**What about SIM swap?**
SMS is what Chilean SMEs have today, so we start there and declare the risk (K4). Production moves to an authenticator app or device binding.

**Why Sepolia and not FISCO BCOS, WeBank's chain?**
FISCO BCOS needs its own node, which we could not run reliably for a public demo in the time we had. The anchoring uses a standard Merkle format, so FISCO BCOS is one more backend behind the same interface; it is first on the roadmap (known risk K8).

## The business

**Have you talked to real exporters?**
Not yet as users, and we do not claim it. What we have are public figures (USD 2.8 bn of cherries a season, 44 days to get paid, 63% of SME invoices paid after the legal 30 days, 20% a year for an SME loan, all sourced on the landing page) and a benchmark of 50 synthetic exporters judged by an independent oracle. The next step is a pilot, below.

**What is the pilot?**
One design-partner lender and 10 of its cherry exporters for one season. We would measure three things: days of warning before a cash crunch, financing cost against the loan the exporter would have taken, and the share of proposals the owner approves. If owners approve fewer than half, the product is wrong, and we would know within the season.

**Who pays?**
The lender: a licence per active SME plus a success fee on financing originated through NanFeng. The exporter uses it free, bundled by its bank. Pricing is a hypothesis we would test in the pilot.

**Why would a bank want this?**
It gets cash-flow data it can verify (hash-chained and anchored) and earlier, cheaper-to-serve loans to exporters it would otherwise lose to factoring. The owner approves every money decision, so the bank's risk policy stays in control.

**What is new here, compared with existing cash-flow tools?**
Existing tools show a forecast. NanFeng acts on it: it finds the cheapest financing, prepares it, and executes it once the owner approves, with controls a bank can audit. "It doesn't advise. It acts, with your permission."

## The demo

**Is the video a replay?**
The product part was recorded in one take on the live site, with the real agent; the 4× badge marks where it is sped up. Anyone can repeat it: the landing page has a "Try it yourself" section with the two documents to download.

**Is any of this real money?**
No. A sandbox bank, a fictional company (Huerto Austral) and synthetic data. The controls, the agent, the optimizer and the on-chain anchors are real.
