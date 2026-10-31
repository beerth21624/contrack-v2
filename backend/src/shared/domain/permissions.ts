// ─── Who may do what inside a workspace (one matrix for every module) ───
// The matrix lives in the shared contract so the web and the server can never disagree (docs/erp PROGRESS.md D-77).
export { PERMISSIONS, can, roleRank, type Permission } from '@contrack/contract';
