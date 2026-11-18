/**
 * Disabled legacy bootstrapper.
 *
 * This script previously rewrote application files and generated placeholder
 * API credentials. Running it against the active repository could overwrite
 * the live server, package manifest, or user data.
 *
 * The active service is managed through reviewed commits and migrations.
 * This script is retained only to prevent old instructions from breaking.
 */

console.error("setup.js is disabled: it can overwrite active application files and must not be executed.");
process.exitCode = 1;
