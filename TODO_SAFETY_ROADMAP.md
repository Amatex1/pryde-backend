# Pryde Safety Hardening Roadmap

## Phase 1 — Contextual Safety Classification

Replaces broad caps/profanity auto-flags with intent-aware, context-sensitive detection.

### ✅ Step 1 — Remove automatic flags for formatting-based signals
- [x] Remove ALL CAPS detection from `moderationV2.js` layer1 (caps_streak signal)
- [x] Remove automatic flags for general profanity (standalone swearing)
- [x] Legacy caps percentage detection already removed from `moderation.js` (commented out)

### ✅ Step 2 — Add `classifyContextualSafety()` to `moderationV2.js`
Categories:
- `identity_attack` — slurs targeting identity (race, gender, sexuality, disability)
- `targeted_harassment` — personal attacks directed at a specific person
- `general_profanity` — swearing without specific target or identity attack
- `self_expression` — emotional outbursts without target or harm intent
- `neutral` — no safety concern

Enforcement tiers:
- `identity_attack` → auto-hide content + riskScore +5 + ModerationEvent logged
- `targeted_harassment` → auto-hide content + riskScore +3 + ModerationEvent logged
- `general_profanity` → log only, no action, no riskScore change
- `self_expression` → allow + log only, no riskScore change

---

## Phase 2 — Risk Scoring System

### ✅ Step 3 — Add risk fields to `User.js` model
Fields added inside `moderation` subdocument:
- `riskScore: Number` — cumulative risk score (default: 0)
- `riskLevel: String` — enum ['low', 'moderate', 'high'] (default: 'low')
- `probationUntil: Date` — probation expiry timestamp (default: null)

### ✅ Step 4 — Add `enforceRiskThreshold()` to `moderationEnforcer.js`
- riskScore ≥ 10 → temporary 24h posting restriction (set `probationUntil`)
- riskScore ≥ 20 → auto-suspend account + flag for admin review

---

## Phase 3 — Probation Mode

### ✅ Step 5 — Probation on new account registration (`auth.js`)
- Set `probationUntil = now + 48 hours` when a new user registers
- Purpose: prevents coordinated abuse from throwaway accounts

### ✅ Step 6 — Probation enforcement middleware (`middleware/moderation.js`)
- Exported as `checkProbation`
- During probation: 3 posts/day limit
- During probation: no external links allowed in post content
- During probation: no DMs unless mutual follow (enforced at DM route level)

### ✅ Step 7 — Apply `checkProbation` to post and comment routes (`posts.js`)
- Added to `POST /api/posts`
- Added to `POST /api/posts/:id/comment`
- Added to `POST /api/posts/:id/comment/:commentId/reply`

---

## Future Phases

### Phase 4 — Pattern Learning
- Track riskScore decay over time (good behavior reduces score)
- Weekly automated review of high-risk accounts
- Appeals system for auto-suspended accounts

### Phase 5 — Cross-Platform Signal Integration
- Integrate V5 enforcement authority once shadow mode exits
- Admin dashboard for risk score visibility
- Bulk risk review tooling
