"""PLACEHOLDER policy check so approvals work end to end. Andy owns the real policy engine
(L0-L3, per-amount and per-day limits, velocity, allowlist, kill switch); replace `evaluate`
with a call to it and keep the return shape.

L0 read-only · L1 act + notify · L2 act within limits · L3 human approval with OTP.
"""

from dataclasses import dataclass

L1_MAX_CLP = 1_000_000
L2_MAX_CLP = 10_000_000
FINANCING_OPS = {"factoring", "loan", "forward"}


@dataclass
class Decision:
    tier: int
    reason: str
    blocked: bool = False


def evaluate(op: str, amount_clp: float, payee_allowlisted: bool = True, kill_switch: bool = False) -> Decision:
    if kill_switch:
        return Decision(3, "Kill switch is on: every action is blocked", blocked=True)
    if op in FINANCING_OPS:
        return Decision(3, "Financing always needs the owner's approval")
    if op == "payment" and not payee_allowlisted:
        return Decision(3, "Payee is not on the allowlist")
    if amount_clp >= L2_MAX_CLP:
        return Decision(3, f"Amount is at or above the L2 limit (CLP {L2_MAX_CLP:,})")
    if amount_clp >= L1_MAX_CLP:
        return Decision(2, "Within the L2 limit")
    return Decision(1, "Below the L1 limit")
