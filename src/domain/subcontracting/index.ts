// ─── Subcontracting (module 1): pure rules shared by the server and the browser ───
// trades + snapshot: written by the coordinator. leveling (bids), claims + contract-template (contracts) are owned by
// the bidding and contracts work streams; each file is self-contained.
export * from './trades';
export * from './snapshot';
export * from './leveling';
export * from './claims';
export * from './contract-template';
