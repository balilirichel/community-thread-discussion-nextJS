/**
 * typesenseClient.ts
 * ********************────────────────────
 * Builds and exports the singleton Typesense JavaScript client.
 *
 * WHY a singleton?
 *   The Typesense client manages an internal connection pool. Creating a new
 *   instance on every search wastes resources and loses connection reuse.
 *   Importing this module always returns the same shared instance.
 *
 * CONFIGURATION SOURCE:
 *   All values come from Vite environment variables (import.meta.env.*).
 *   Variables MUST be prefixed with VITE_ — Vite strips anything else from
 *   the browser bundle at build time for security.
 *
 */

import Typesense from 'typesense';

// ─── Read environment variables ───────────────────────────────────────────────
// Fallbacks are provided so the app degrades gracefully in misconfigured envs.
const TYPESENSE_HOST = process.env.NEXT_PUBLIC_TYPESENSE_HOST ?? '127.0.0.1';
const TYPESENSE_PORT = Number(process.env.NEXT_PUBLIC_TYPESENSE_PORT ?? 8108);
const TYPESENSE_PROTOCOL = process.env.NEXT_PUBLIC_TYPESENSE_PROTOCOL ?? 'http';
const TYPESENSE_API_KEY = process.env.NEXT_PUBLIC_TYPESENSE_API_KEY ?? '';

if (!TYPESENSE_API_KEY) {
  console.warn(
    'TYPESENSE_API_KEY is not set. '
  );
}

// **** Build the client ********************
const typesenseClient = new Typesense.Client({
  /**
   * nodes — array of Typesense server addresses.
   * In production, list all your cluster nodes for automatic failover.
   * For local dev a single node is sufficient.
   */
  nodes: [
    {
      host: TYPESENSE_HOST,
      port: TYPESENSE_PORT,
      protocol: TYPESENSE_PROTOCOL as 'http' | 'https',
    },
  ],

  /**
   * apiKey — must be a search-only key.
   */
  apiKey: TYPESENSE_API_KEY,

  /**
   * connectionTimeoutSeconds — how long to wait for a node to respond.
   * 3 s is a sensible default for local/LAN Typesense; increase for remote.
   */
  connectionTimeoutSeconds: 3,

  /**
   * numRetries — on failure, automatically retry on the next node in the list.
   * With a single-node setup this effectively gives one retry.
   */
  numRetries: 1,

  /**
   * retryIntervalSeconds — gap between retries.
   */
  retryIntervalSeconds: 0.1,
});

export default typesenseClient;
