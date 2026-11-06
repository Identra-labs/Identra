import { describe, it, expect } from "vitest";
import {
  cliVersion,
  parseArgs,
  dispatch,
  handleCreateIdentity,
  handleAddIssuer,
  handleRegisterSchema,
  handleIssue,
  handleRevoke,
  handleVerify,
  handleHelp,
  handleVersion,
} from "./cli.js";

const VALID_HEX32 = "a".repeat(64);
const CONTRACT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCT4";
const ISSUER_ADDR = "GBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

// ── version ───────────────────────────────────────────────────────────────────

describe("cliVersion", () => {
  it("contains identra-cli", () => {
    expect(cliVersion()).toContain("identra-cli");
  });
  it("contains sdk version", () => {
    expect(cliVersion()).toContain("sdk");
  });
});

// ── parseArgs ─────────────────────────────────────────────────────────────────

describe("parseArgs", () => {
  it("extracts command from positional", () => {
    const r = parseArgs(["node", "cli.js", "create-identity"]);
    expect(r.command).toBe("create-identity");
  });

  it("parses --key value flags", () => {
    const r = parseArgs(["node", "cli.js", "issue", "--network", "testnet"]);
    expect(r.flags.network).toBe("testnet");
  });

  it("parses --key=value flags", () => {
    const r = parseArgs(["node", "cli.js", "issue", "--network=testnet"]);
    expect(r.flags.network).toBe("testnet");
  });

  it("defaults command to help when no args", () => {
    const r = parseArgs(["node", "cli.js"]);
    expect(r.command).toBe("help");
  });

  it("collects multiple flags", () => {
    const r = parseArgs([
      "node",
      "cli.js",
      "issue",
      "--identity",
      "alice",
      "--network",
      "testnet",
    ]);
    expect(r.flags.identity).toBe("alice");
    expect(r.flags.network).toBe("testnet");
  });
});

// ── help ──────────────────────────────────────────────────────────────────────

describe("handleHelp", () => {
  it("returns ok and mentions all commands", () => {
    const r = handleHelp();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("create-identity");
    expect(r.message).toContain("add-issuer");
    expect(r.message).toContain("register-schema");
    expect(r.message).toContain("issue");
    expect(r.message).toContain("revoke");
    expect(r.message).toContain("verify");
  });
  it("never mentions raw secret key or seed phrase", () => {
    const r = handleHelp();
    expect(r.message.toLowerCase()).not.toContain("seed phrase");
    // Help may say "named identities" but must not instruct passing raw secrets
    expect(r.message).not.toContain("--secret");
  });
});

// ── handleVersion ─────────────────────────────────────────────────────────────

describe("handleVersion", () => {
  it("returns version string", () => {
    const r = handleVersion();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("identra-cli");
  });
});

// ── handleCreateIdentity ──────────────────────────────────────────────────────

describe("handleCreateIdentity", () => {
  const valid = {
    identity: "alice",
    network: "testnet",
    contract: CONTRACT,
    hash: VALID_HEX32,
  };

  it("builds stellar contract invoke command", () => {
    const r = handleCreateIdentity(valid);
    expect(r.ok).toBe(true);
    expect(r.message).toContain("create_identity");
    expect(r.message).toContain(CONTRACT);
  });

  it("throws on missing --identity", () => {
    const noIdentity = Object.fromEntries(
      Object.entries(valid).filter(([k]) => k !== "identity"),
    );
    expect(() => handleCreateIdentity(noIdentity)).toThrow("--identity");
  });

  it("throws on invalid hash length", () => {
    expect(() =>
      handleCreateIdentity({ ...valid, hash: "abc" }),
    ).toThrow("64-character");
  });

  it("never includes secret key in output", () => {
    const r = handleCreateIdentity(valid);
    expect(r.message.toLowerCase()).not.toContain("secret");
  });
});

// ── handleAddIssuer ───────────────────────────────────────────────────────────

describe("handleAddIssuer", () => {
  const valid = {
    identity: "admin",
    network: "testnet",
    contract: CONTRACT,
    issuer: ISSUER_ADDR,
  };

  it("builds add_issuer command", () => {
    const r = handleAddIssuer(valid);
    expect(r.ok).toBe(true);
    expect(r.message).toContain("add_issuer");
    expect(r.message).toContain(ISSUER_ADDR);
  });

  it("throws on missing --issuer", () => {
    const noIssuer = Object.fromEntries(
      Object.entries(valid).filter(([k]) => k !== "issuer"),
    );
    expect(() => handleAddIssuer(noIssuer)).toThrow("--issuer");
  });
});

// ── handleRegisterSchema ──────────────────────────────────────────────────────

describe("handleRegisterSchema", () => {
  const valid = {
    identity: "alice",
    network: "testnet",
    contract: CONTRACT,
    version: "1",
    "schema-hash": VALID_HEX32,
  };

  it("builds register_schema command", () => {
    const r = handleRegisterSchema(valid);
    expect(r.ok).toBe(true);
    expect(r.message).toContain("register_schema");
  });

  it("throws on invalid schema-hash", () => {
    expect(() =>
      handleRegisterSchema({ ...valid, "schema-hash": "short" }),
    ).toThrow("64-character");
  });
});

// ── handleIssue ───────────────────────────────────────────────────────────────

describe("handleIssue", () => {
  const valid = {
    identity: "issuer1",
    network: "testnet",
    contract: CONTRACT,
    subject: ISSUER_ADDR,
    "schema-id": "1",
    "claims-root": VALID_HEX32,
    expiry: "9999999999",
  };

  it("builds issue command", () => {
    const r = handleIssue(valid);
    expect(r.ok).toBe(true);
    expect(r.message).toContain("issue");
    expect(r.message).toContain(VALID_HEX32);
  });

  it("throws on invalid claims-root", () => {
    expect(() =>
      handleIssue({ ...valid, "claims-root": "bad" }),
    ).toThrow("64-character");
  });

  it("throws on missing --expiry", () => {
    const noExpiry = Object.fromEntries(
      Object.entries(valid).filter(([k]) => k !== "expiry"),
    );
    expect(() => handleIssue(noExpiry)).toThrow("--expiry");
  });
});

// ── handleRevoke ──────────────────────────────────────────────────────────────

describe("handleRevoke", () => {
  const valid = {
    identity: "issuer1",
    network: "testnet",
    contract: CONTRACT,
    "credential-id": "42",
  };

  it("builds revoke command", () => {
    const r = handleRevoke(valid);
    expect(r.ok).toBe(true);
    expect(r.message).toContain("revoke");
    expect(r.message).toContain("42");
  });

  it("throws on missing --credential-id", () => {
    const noCred = Object.fromEntries(
      Object.entries(valid).filter(([k]) => k !== "credential-id"),
    );
    expect(() => handleRevoke(noCred)).toThrow("--credential-id");
  });
});

// ── handleVerify ──────────────────────────────────────────────────────────────

describe("handleVerify", () => {
  const valid = {
    root: VALID_HEX32,
    status: "Valid",
  };

  it("returns verify summary", () => {
    const r = handleVerify(valid);
    expect(r.ok).toBe(true);
    expect(r.message).toContain("root=");
    expect(r.message).toContain("Valid");
  });

  it("throws on invalid status", () => {
    expect(() =>
      handleVerify({ ...valid, status: "BadStatus" }),
    ).toThrow("Valid");
  });

  it("throws on invalid root hex", () => {
    expect(() => handleVerify({ ...valid, root: "short" })).toThrow(
      "64-character",
    );
  });
});

// ── dispatch ──────────────────────────────────────────────────────────────────

describe("dispatch", () => {
  it("routes help command", () => {
    const r = dispatch({ command: "help", flags: {}, positional: [] });
    expect(r.message).toContain("create-identity");
  });

  it("routes version command", () => {
    const r = dispatch({ command: "version", flags: {}, positional: [] });
    expect(r.message).toContain("identra-cli");
  });

  it("unknown command falls through to help", () => {
    const r = dispatch({ command: "unknown-cmd", flags: {}, positional: [] });
    expect(r.message).toContain("create-identity");
  });
});
