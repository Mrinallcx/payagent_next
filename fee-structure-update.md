# Fee Structure Update

**Q: Did you change the fee structure? LCX utility is great but it should not complicate adoption and usage.**

---

Yes, we updated the fee fallback logic — specifically to **simplify adoption**, not complicate it.

## What Changed

Previously, if a payer didn't hold LCX, the fee fell back to **USDC** — meaning the payer needed to hold *both* their payment token (e.g. USDT, ETH) *and* USDC separately just to cover the fee. That's friction.

Now, the fee is deducted from the **same token the payer is already sending**. No extra token required.

## How It Works Now

| Scenario | Fee | Creator Receives |
|----------|-----|-----------------|
| Payer holds >= 4 LCX | 4 LCX (2 platform + 2 creator reward) | Full payment amount |
| Payer holds < 4 LCX | Fee deducted from payment token (50/50 split) | Amount minus fee |

## Examples

- **Paying 100 USDT, no LCX** → Fee ~$0.60 USDT deducted → Creator gets ~99.40 USDT. Payer only needs USDT + ETH for gas.
- **Paying 100 USDT, has LCX** → Fee is 4 LCX (separate) → Creator gets full 100 USDT. Incentive to hold LCX.
- **Paying 0.5 ETH, no LCX** → Fee converted to ETH equivalent via live price → Creator gets 0.5 ETH minus tiny ETH fee.

## LCX Utility Is Preserved

- Holding LCX remains the **preferred** path — the creator receives the **full amount** and the fee is smaller in dollar terms.
- LCX holders get better economics. That's the incentive.
- But non-LCX holders are no longer blocked or forced to acquire a second token.

## Bottom Line

One token to pay, one token for gas. That's it. LCX makes it cheaper, but it's never a barrier.
