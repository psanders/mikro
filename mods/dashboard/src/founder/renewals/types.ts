/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Viewer } from "../applications/useViewer";
import type { RenewalData, RenewalQuoteData, RenewalTab } from "./helpers";

/** What every renewal panel view receives from the shell. */
export interface RenewalViewProps {
  renewal: RenewalData;
  quote: RenewalQuoteData | undefined;
  viewer: Viewer | null;
  /** Re-read the renewal, its quote, its documents and the feed. */
  refresh: () => Promise<void>;
  goTo: (tab: RenewalTab) => void;
  /** Ask to cancel (opens the confirmation). */
  requestCancel: () => void;
}
