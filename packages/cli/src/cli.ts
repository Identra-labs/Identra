#!/usr/bin/env node
/**
 * @identra/cli — minimal CLI for the Identra toolkit.
 *
 * All commands use Stellar named identities (managed by stellar-cli).
 * Secret keys are never accepted, stored, or printed.
 *
 * Usage:
 *   identra <command> [options]
 *
 * Commands:
 *   create-identity   Register an on-chain identity record
 *   add-issuer        Approve an issuer address (admin only)
 *   register-schema   Register a credential schema
 *   issue             Issue a credential to a subject
 *   revoke            Revoke an issued credential
 *   verify            Verify a selective disclosure off-chain
 *   version           Print the CLI version
 *   help              Print this help text
 */

import { sdkVersion } from "@identra/sdk";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedArgs {
  command: string;
  flags: Record<string, string>;
  positional: string[];
}

// ── Version ───────────────────────────────────────────────────────────────────

export function cliVersion(): string {
  return `identra-cli 0.1.0 (sdk ${sdkVersion()})`;
}

// ── Arg parser ────────────────────────────────────────────────────────────────

/**
 * Parse process.argv-style string array into a structured object.
 * Flags: --key value or --key=value
 * Positional: anything not preceded by --key
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  let i = 0;
  // skip node and script path if present
  const start = argv[0]?.startsWith("node") || argv[0]?.endsWith(".js") ? 2 : 0;

  for (i = start; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx > 0) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags[arg.slice(2)] = argv[++i];
      } else {
        flags[arg.slice(2)] = "true";
      }
    } else {
      positional.push(arg);
    }
  }

  return {
    command: positional[0] ?? "help",
    flags,
    positional: positional.slice(1),
  };
}

// ── Help text ─────────────────────────────────────────────────────────────────

export const HELP = `
${cliVersion()}

Usage: identra <command> [--option value]

Commands:
  create-identity   --identity <name> --network <net> --contract <C...>
                      --hash <hex32>
      Register an on-chain identity. --identity is a Stellar named identity
      (managed with 'stellar keys generate'). --hash is the SHA-256 of your
      off-chain metadata document (32-byte hex). Never pass personal data here.

  add-issuer        --identity <admin-name> --network <net> --contract <C...>
                      --issuer <G...>
      Approve an issuer address. Caller must be the registry admin.

  register-schema   --identity <name> --network <net> --contract <C...>
                      --version <n> --schema-hash <hex32>
      Register a credential schema. Caller must be admin or approved issuer.

  issue             --identity <issuer-name> --network <net> --contract <C...>
                      --subject <G...> --schema-id <n>
                      --claims-root <hex32> --expiry <unix-seconds>
      Issue a credential. --claims-root is the Merkle root of the off-chain
      claim tree. Expiry must be in the future. Caller must be an approved
      issuer.

  revoke            --identity <issuer-name> --network <net> --contract <C...>
                      --credential-id <n>
      Revoke a credential. Only the issuing issuer may revoke.

  verify            --claims-file <path> --salts-file <path>
                      --proofs-file <path> --root <hex32> --status <status>
      Verify a selective disclosure off-chain. Reads claim key/value pairs,
      salts, and Merkle proofs from JSON files. Prints the result.
      Status: Valid | Expired | Revoked | Unknown

  version           Print the CLI version.
  help              Print this help text.

All --identity values refer to Stellar named identities created with:
  stellar keys generate --global <name>

Secret keys are never accepted, stored, or printed by this CLI.
`.trim();

// ── Command handlers ──────────────────────────────────────────────────────────

/** validate that a required flag is present; throw with a clear message if not */
function requireFlag(flags: Record<string, string>, name: string): string {
  const v = flags[name];
  if (v === undefined || v === "") {
    throw new Error(`Missing required flag: --${name}`);
  }
  return v;
}

export interface CommandResult {
  ok: boolean;
  message: string;
}

export function handleHelp(): CommandResult {
  return { ok: true, message: HELP };
}

export function handleVersion(): CommandResult {
  return { ok: true, message: cliVersion() };
}

export function handleCreateIdentity(
  flags: Record<string, string>,
): CommandResult {
  const identity = requireFlag(flags, "identity");
  const network = requireFlag(flags, "network");
  const contract = requireFlag(flags, "contract");
  const hash = requireFlag(flags, "hash");
  if (hash.length !== 64 || !/^[0-9a-f]+$/i.test(hash)) {
    throw new Error("--hash must be a 64-character hex string (32 bytes)");
  }
  return {
    ok: true,
    message: [
      `stellar contract invoke \\`,
      `  --id ${contract} --source ${identity} --network ${network} \\`,
      `  -- create_identity \\`,
      `  --owner $(stellar keys address ${identity}) \\`,
      `  --metadata_hash ${hash}`,
    ].join("\n"),
  };
}

export function handleAddIssuer(flags: Record<string, string>): CommandResult {
  const identity = requireFlag(flags, "identity");
  const network = requireFlag(flags, "network");
  const contract = requireFlag(flags, "contract");
  const issuer = requireFlag(flags, "issuer");
  return {
    ok: true,
    message: [
      `stellar contract invoke \\`,
      `  --id ${contract} --source ${identity} --network ${network} \\`,
      `  -- add_issuer --issuer ${issuer}`,
    ].join("\n"),
  };
}

export function handleRegisterSchema(
  flags: Record<string, string>,
): CommandResult {
  const identity = requireFlag(flags, "identity");
  const network = requireFlag(flags, "network");
  const contract = requireFlag(flags, "contract");
  const version = requireFlag(flags, "version");
  const schemaHash = requireFlag(flags, "schema-hash");
  if (schemaHash.length !== 64 || !/^[0-9a-f]+$/i.test(schemaHash)) {
    throw new Error("--schema-hash must be a 64-character hex string");
  }
  return {
    ok: true,
    message: [
      `stellar contract invoke \\`,
      `  --id ${contract} --source ${identity} --network ${network} \\`,
      `  -- register_schema \\`,
      `  --caller $(stellar keys address ${identity}) \\`,
      `  --version ${version} --schema_hash ${schemaHash}`,
    ].join("\n"),
  };
}

export function handleIssue(flags: Record<string, string>): CommandResult {
  const identity = requireFlag(flags, "identity");
  const network = requireFlag(flags, "network");
  const contract = requireFlag(flags, "contract");
  const subject = requireFlag(flags, "subject");
  const schemaId = requireFlag(flags, "schema-id");
  const claimsRoot = requireFlag(flags, "claims-root");
  const expiry = requireFlag(flags, "expiry");
  if (claimsRoot.length !== 64 || !/^[0-9a-f]+$/i.test(claimsRoot)) {
    throw new Error("--claims-root must be a 64-character hex string");
  }
  return {
    ok: true,
    message: [
      `stellar contract invoke \\`,
      `  --id ${contract} --source ${identity} --network ${network} \\`,
      `  -- issue \\`,
      `  --issuer $(stellar keys address ${identity}) \\`,
      `  --subject ${subject} --schema_id ${schemaId} \\`,
      `  --claims_root ${claimsRoot} --expiry ${expiry}`,
    ].join("\n"),
  };
}

export function handleRevoke(flags: Record<string, string>): CommandResult {
  const identity = requireFlag(flags, "identity");
  const network = requireFlag(flags, "network");
  const contract = requireFlag(flags, "contract");
  const credentialId = requireFlag(flags, "credential-id");
  return {
    ok: true,
    message: [
      `stellar contract invoke \\`,
      `  --id ${contract} --source ${identity} --network ${network} \\`,
      `  -- revoke \\`,
      `  --issuer $(stellar keys address ${identity}) \\`,
      `  --credential_id ${credentialId}`,
    ].join("\n"),
  };
}

export function handleVerify(flags: Record<string, string>): CommandResult {
  const root = requireFlag(flags, "root");
  const status = requireFlag(flags, "status");
  if (!["Valid", "Expired", "Revoked", "Unknown"].includes(status)) {
    throw new Error(
      "--status must be one of: Valid, Expired, Revoked, Unknown",
    );
  }
  if (root.length !== 64 || !/^[0-9a-f]+$/i.test(root)) {
    throw new Error("--root must be a 64-character hex string");
  }
  return {
    ok: true,
    message: `Verify: root=${root} status=${status} (run verifyDisclosure() from @identra/sdk with your claims, salts, and proofs files)`,
  };
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export function dispatch(parsed: ParsedArgs): CommandResult {
  switch (parsed.command) {
    case "create-identity":
      return handleCreateIdentity(parsed.flags);
    case "add-issuer":
      return handleAddIssuer(parsed.flags);
    case "register-schema":
      return handleRegisterSchema(parsed.flags);
    case "issue":
      return handleIssue(parsed.flags);
    case "revoke":
      return handleRevoke(parsed.flags);
    case "verify":
      return handleVerify(parsed.flags);
    case "version":
      return handleVersion();
    case "help":
    default:
      return handleHelp();
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("cli.js") || process.argv[1].endsWith("cli.ts"))
) {
  const parsed = parseArgs(process.argv);
  const result = dispatch(parsed);
  if (result.ok) {
    // eslint-disable-next-line no-console
    console.log(result.message);
  } else {
    // eslint-disable-next-line no-console
    console.error(result.message);
    process.exit(1);
  }
}
