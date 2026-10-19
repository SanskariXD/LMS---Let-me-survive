# LMS² security review — 18 October 2026

Scope: `SanskariXD/LMS---Let-me-survive`, based on commit `0c36de3208f63b32b21c7ab328c1004d37038307`. Source review, Git-history pattern scans, local database/handler regression tests, dependency advisories, and local production HTTP checks. No attacks or authenticated probes were sent to the university service. This is not a guarantee that no vulnerabilities remain.

## Findings and remediation

| Finding | Impact | Change |
| --- | --- | --- |
| Unsigned remembered-device cookie drove unauthenticated database lookup | Student profile lookup without login | Signed, expiring, HttpOnly device cookies with a separate signature purpose; old unsigned cookies rejected |
| Task update readback omitted the owner predicate | A signed-in user could receive another user's task although the update was blocked | Both write and readback now include owner ID |
| Routes trusted `x-user-id` as fallback identity | Unsafe if middleware was bypassed; public resource listing already accepted that header | Removed header trust; signed-session checks inside protected handlers |
| Public diagnostics exposed shared logs and probed upstream | Cross-account metadata exposure and unauthenticated upstream traffic | Minimal public liveness response; no shared logs or upstream probe |
| Unlimited PIN guessing and account-specific failure messages | Six-digit PIN brute-force and account enumeration | Atomic persistent account/IP attempt limits, generic failure response, numeric PIN validation |
| Logout only deleted a browser cookie | A copied cookie remained replayable | Persist hashed revoked tokens; verify revocation in route authentication; clear cached upstream token |
| Plaintext upstream tokens in DB | DB read access disclosed usable tokens | AES-GCM encrypted new writes; initialization migrates existing plaintext tokens; token reads decrypt only server-side |
| Weak encryption-key derivation | Only the first 32 bytes of SESSION_SECRET were used for encryption | HKDF and versioned ciphertext for new writes; legacy decoder retained for existing passwords |
| HTTP university default and redirect following | Credentials/tokens could cross an unencrypted connection or redirect | Require an explicitly configured HTTPS origin, except loopback HTTP during development; refuse redirects |
| Silent default-operator credential fallback | Missing account context could invoke the operator account | Account ID or explicitly supplied newly authenticated token required |
| Inconsistent mutation-origin checks; unbounded body reads | Cross-site actions and avoidable memory abuse | Handler origin checks, streamed JSON/multipart limits, import bounds |
| File extension was checked but MIME allowlist was unused | Active or mismatched uploaded content and data-URL fallback | Validate MIME and common magic bytes; download content type; random blob names; no data-URL fallback; upload rate limit |
| Arbitrary resource/task link schemes | Script/data links could be persisted | HTTPS task links and Vercel public Blob URLs for shared resources |
| Automatic migration of unscoped browser data | Previous account's cached data could be imported into another account | Removed automatic migration; clear private caches on explicit login/lock/account switch |
| Runtime dependency advisories | Known affected dependency versions | Next.js/eslint-config-next 16.3.8; sharp 0.35.5 and source-map-js 1.2.2 overrides in both package-manager configurations |

The critical Next.js advisory concerned attacker-controlled SVG in Node `next/og` ImageResponse. No use of that API was found in this application; the dependency was upgraded regardless. References: <https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j>, <https://github.com/advisories/GHSA-wq5f-xc86-pv6w>, <https://github.com/advisories/GHSA-68fv-2mgg-jv7q>.

## Validation

- 27 reachable commits / 331 unique blobs scanned for common token, private-key, credential-URL and hardcoded-secret patterns, including the tracked ZIP archive. No matching secrets were found. Pattern scans cannot establish absence of secrets and do not inspect deployment values, external forks, or deleted/unreachable remote objects.
- `npm test`: registration suite plus security regressions for cookie tampering, token replay, task ownership, PIN throttling, header spoofing, request size, URL validation, and encrypted storage. All tests use synthetic accounts and local databases.
- `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
- Local production HTTP checks: unauthorized API access, middleware-bypass-style header, same-origin unauthenticated registration, cross-site login/logout, anonymous session, public resource list, minimal health and security headers.
- Runtime-only npm audit reports zero known vulnerabilities after updates. Both npm and pnpm locks are updated and pin patched runtime transitive versions.
- Full ESLint is **not clean**: substantial pre-existing errors remain (baseline 151 errors). These include broad `any` use and React hook rules; they are not being silently suppressed or described as passing.

## Deployment requirements and remaining work

1. **University transport:** set `UNIVERSITY_BASE_URL` to the institution's valid HTTPS origin. If the institution only provides HTTP, an institutional TLS endpoint or a secured private tunnel is required. Simply placing an HTTPS proxy in front of an HTTP Internet hop does not secure that hop. The patched application refuses to transmit credentials over remote HTTP, so upstream login/sync/registration remain unavailable until transport is configured correctly. Local cached data can still be used where available.
2. **Persistent DB:** configure Turso/libSQL over encrypted transport. Production refuses an unconfigured ephemeral local DB. `ALLOW_LOCAL_DATABASE=true` is only for a deliberately provisioned persistent filesystem, not serverless `/tmp`. The shared DB must be available for login throttling and session revocation. Keep backups and least-privilege credentials.
3. **Secrets:** `SESSION_SECRET` must be a high-entropy value of at least 32 bytes and remain server-only. Preserve the current valid secret when deploying: changing it invalidates sessions AND makes stored university passwords/tokens unreadable. Rotation needs a controlled decrypt/re-encrypt migration or user reauthentication. No deployment secret was read or changed during this review.
4. **Migration:** DB initialization encrypts legacy plaintext upstream token rows. This executes when the patched backend first uses the configured DB; pushing source alone does not prove the live DB has migrated. Old backups may still contain plaintext tokens.
5. **Development dependency:** `braces` 3.0.3 remains affected by GHSA-vfj7-8cjw-p6xm through the ESLint/fast-glob chain. The available registry release had no patch during this review. This is development tooling, not a runtime dependency; do not feed untrusted glob patterns into lint tooling. No breaking framework downgrade was applied to conceal the advisory.
6. **Resources:** the resource hub and uploaded Blob links remain intentionally public. Do not upload private student records there. Type and signature checks are not malware scanning; ZIP/Office/PDF payloads may still contain malicious content. Private sharing needs a private Blob store plus authorized download delivery and a malware-scanning service.
7. **Browser storage:** offline data is not encrypted against someone with local browser/device access or an existing XSS foothold. Private caches are cleared at lock/account switch; device-local profile hints may remain for quick PIN login. A full authenticated offline encryption design is separate work.
8. **Availability:** account lockouts can be deliberately triggered; fixed windows allow boundary bursts. Use platform WAF/rate controls for large-scale traffic. Per-IP buckets rely only on Vercel's overwritten forwarding header; other hosts use a conservative shared bucket and need a trusted adapter before scaling.
9. **Public source:** this repo remains public. Endpoint knowledge is not an authentication bypass. Making it private cannot erase existing forks/copies and does not replace backend authorization. No visibility changes or history rewrites were performed.
10. **Live verification:** the audit does not establish whether deployed environment values, platform permissions, storage ACLs or university-side authorization are safe. Push/deployment success and the code tests do not substitute for those checks.

CI repeats tests, type-checking, runtime dependency audit and the production build without production credentials.
