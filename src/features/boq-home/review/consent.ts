// ─── Consent before the decision model sees a BOQ ───
// The model is asked only after the user confirms in a dialog, never on a data change. Pure: no React, no network.
// Tomorrow's per-user limits (a premium plan) plug in here and in the backend's AiAccess, not in the button.

export interface AiReviewGate {
    signedIn: boolean;
    /** Module `ai-assist` on for the current workspace (platform and workspace switches). */
    moduleEnabled: boolean;
    workspaceId: string | undefined;
    /** Item rows the review would send. */
    rowCount: number;
}

/**
 * What a click on "Check BOQ before sending" does: `ask` = show the consent dialog (the model can be used),
 * `rules` = open the panel with the deterministic rules only (nothing is sent anywhere).
 */
export function reviewClickAction(gate: AiReviewGate): 'ask' | 'rules' {
    return gate.signedIn && gate.moduleEnabled && gate.workspaceId !== undefined && gate.rowCount > 0 ? 'ask' : 'rules';
}
