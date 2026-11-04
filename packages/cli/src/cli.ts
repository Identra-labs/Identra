/**
 * @identra/cli
 *
 * Stub entry point — will be fully implemented in Spec 5.
 */
import { sdkVersion } from "@identra/sdk";

/** Print the CLI version. Used to confirm the package loads. */
export function cliVersion(): string {
  return `identra-cli 0.1.0 (sdk ${sdkVersion()})`;
}
