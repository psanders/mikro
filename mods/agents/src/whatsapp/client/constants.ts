/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * Meta Graph API version used for every WhatsApp Cloud API call (send, template,
 * media upload/download). Single source of truth — bump here, not in each caller.
 *
 * Pinned to v23.0 (May 2025): mature, long support runway. The parameters used by
 * this client (messages, media) are unchanged across v18–v25; only the path
 * segment differs. Latest is v25.0 if a future bump is wanted.
 */
export const GRAPH_API_VERSION = "v23.0";

/** Base Graph API URL for the pinned version (no trailing slash). */
export const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
