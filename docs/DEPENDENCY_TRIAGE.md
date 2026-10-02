# Dependency advisory triage

Snapshot: [CI run 36974789056](https://github.com/bomberpilot/workout-companion/actions/runs/36974789056), implementation commit `ac779fed2bf9d0fad84842c10f62d1e520ae09ed`. Reproduce with `npm run dependencies:report`; the audit service can change over time.

No dependency versions changed in the native-auth slice. The CI report is informational and fails on audit-service/invalid-response errors, not on valid advisories. It must not be described as a passing security gate.

| Lockfile | Critical | High | Moderate | Low | Total affected package entries |
| --- | ---: | ---: | ---: | ---: | ---: |
| App | 4 | 15 | 18 | 1 | 38 |
| Functions | 3 | 4 | 12 | 1 | 20 |

Counts may overlap between graphs and do not equal distinct exploitable vulnerabilities. Reachability in shipped native bundles, deployed functions or build tooling has not yet been established. Lower severity entries remain in the reproducible JSON inventory.

## High and critical entries

The advisory column links one highest-severity advisory per package; the report contains all contributing advisories. Installed versions come from the unchanged lockfiles. A compatible fix reported by npm is a candidate for review, not evidence of a validated upgrade.

| Graph | Package | Locked version(s) | Severity | npm fix indication | Advisory |
| --- | --- | --- | --- | --- | --- |
| App | @grpc/grpc-js | 1.9.15 | high | Compatible candidate | [@grpc/grpc-js: A malformed request can cause a server crash](https://github.com/advisories/GHSA-5375-pq7m-f5r2) |
| App | @isaacs/brace-expansion | 5.0.0 | high | Compatible candidate | [@isaacs/brace-expansion has Uncontrolled Resource Consumption](https://github.com/advisories/GHSA-7h2j-956f-4vf2) |
| App | @xmldom/xmldom | 0.8.11 | high | Compatible candidate | [xmldom: XML injection via unsafe CDATA serialization allows attacker-controlled markup insertion](https://github.com/advisories/GHSA-wh4c-j3r5-mjhp) |
| App | brace-expansion | 1.1.12, 2.0.2 | high | Compatible candidate | [brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) |
| App | browserslist | 4.28.1 | high | Compatible candidate | [Browserslist: Unbounded memory growth (no cache eviction) via distinct query results, leading to eventual OOM](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) |
| App | image-size | 1.2.1 | high | Compatible candidate | [image-size: JXL and HEIF parsers allow denial of service through infinite loops](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) |
| App | js-yaml | 4.1.1, 3.14.2 | high | Compatible candidate | [js-yaml: YAML merge-key chains can force quadratic CPU consumption](https://github.com/advisories/GHSA-52cp-r559-cp3m) |
| App | lodash | 4.17.21 | high | Compatible candidate | [lodash vulnerable to Code Injection via `_.template` imports key names](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) |
| App | minimatch | 10.1.1, 3.1.2, 8.0.4, 9.0.5 | high | Compatible candidate | [minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern](https://github.com/advisories/GHSA-3ppc-4f35-3m26) |
| App | nanoid | 3.3.11 | high | Compatible candidate | [nanoid: non-secure generators can loop indefinitely with negative size](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) |
| App | node-forge | 1.3.3 | high | Compatible candidate | [Forge has a basicConstraints bypass in its certificate chain verification (RFC 5280 violation)](https://github.com/advisories/GHSA-2328-f5f3-gj25) |
| App | picomatch | 3.0.1, 2.3.1, 4.0.3 | high | Compatible candidate | [Picomatch has a ReDoS vulnerability via extglob quantifiers](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) |
| App | postcss | 8.4.49 | high | expo 57.0.26 (major) | [PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments](https://github.com/advisories/GHSA-6g55-p6wh-862q) |
| App | protobufjs | 7.5.4 | critical | Compatible candidate | [Arbitrary code execution in protobufjs](https://github.com/advisories/GHSA-xq3m-2v4x-88gg) |
| App | shell-quote | 1.8.3 | critical | Compatible candidate | [shell-quote quote() does not escape newlines in object .op values](https://github.com/advisories/GHSA-w7jw-789q-3m8p) |
| App | tar | 7.5.2 | critical | Compatible candidate | [node-tar: Decompression/parse DoS via unlimited input](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) |
| App | undici | 6.22.0 | high | Compatible candidate | [Undici: Malicious WebSocket 64-bit length overflows parser and crashes the client](https://github.com/advisories/GHSA-f269-vfmq-vjvj) |
| App | websocket-driver | 0.7.4 | critical | Compatible candidate | [websocket-driver: Message corruption via abuse of protocol length headers](https://github.com/advisories/GHSA-xv26-6w52-cph6) |
| App | ws | 6.2.3, 8.18.3, 7.5.10 | high | Compatible candidate | [ws: Memory exhaustion DoS from tiny fragments and data chunks](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) |
| Functions | @grpc/grpc-js | 1.14.3 | high | Compatible candidate | [@grpc/grpc-js: A malformed request can cause a server crash](https://github.com/advisories/GHSA-5375-pq7m-f5r2) |
| Functions | fast-xml-parser | 4.5.3 | critical | Compatible candidate | [fast-xml-parser has an entity encoding bypass via regex injection in DOCTYPE entity names](https://github.com/advisories/GHSA-m7jm-9gc2-mpf2) |
| Functions | form-data | 2.5.5 | high | Compatible candidate | [form-data: CRLF injection in form-data via unescaped multipart field names and filenames](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) |
| Functions | node-forge | 1.3.3 | high | Compatible candidate | [Forge has a basicConstraints bypass in its certificate chain verification (RFC 5280 violation)](https://github.com/advisories/GHSA-2328-f5f3-gj25) |
| Functions | path-to-regexp | 0.1.12 | high | Compatible candidate | [path-to-regexp vulnerable to Regular Expression Denial of Service via multiple route parameters](https://github.com/advisories/GHSA-37ch-88jc-xwx2) |
| Functions | protobufjs | 7.5.4 | critical | Compatible candidate | [Arbitrary code execution in protobufjs](https://github.com/advisories/GHSA-xq3m-2v4x-88gg) |
| Functions | websocket-driver | 0.7.4 | critical | Compatible candidate | [websocket-driver: Message corruption via abuse of protocol length headers](https://github.com/advisories/GHSA-xv26-6w52-cph6) |

## Remediation order

1. Inspect dependency chains and runtime reachability for backend parsing/network packages, especially protobufjs, fast-xml-parser, websocket-driver and @grpc/grpc-js. Review compatible patch/minor lockfile updates first and validate the exported-callable tests plus backend/emulator operations.
2. Review shared app Firebase/network packages and build/tooling advisories, including protobufjs, websocket-driver, undici, tar and shell-quote. Do not assume a Node-oriented package is absent from the release without inspecting the resolved graph/bundle.
3. Re-run both audits after each reviewed update and preserve mobile/backend TypeScript, all regression tests and both bundle exports. Changes to Auth require the physical-device session smoke cases; deployed functions require reviewed staging validation.
4. Handle unavoidable major upgrades in a separate aligned dependency PR. npm currently suggests Expo 57.0.26, expo-notifications 57.0.21 and firebase-admin 14.5.0 for some entries. Those are audit-service suggestions, not verified compatibility recommendations; keep Expo/React Native packages aligned and preserve the existing Functions API or explicitly migrate/test it.

Do not run `npm audit fix --force` to erase the report. Security/rules, server-owned membership and canonical-workout corrections remain release-critical alongside dependency remediation.
