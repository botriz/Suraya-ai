/**
 * Deprecated prototype bootstrapper.
 *
 * This script previously created JSON wallet files and overwrote server.js.
 * It is intentionally disabled to protect the active production application.
 * Do not reintroduce filesystem-based balances or simulated payment flows.
 * Revenue features must be implemented as reviewed, versioned migrations and
 * authenticated API modules backed by PostgreSQL and verified payment events.
 */

console.error(
  "setup-revenue.js is disabled: it is a destructive legacy prototype and must not be executed."
);
process.exitCode = 1;
