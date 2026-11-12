# ConTrack — customer sandbox

This branch (`customer/sandbox`) is for the customer to try changes on. **Before doing anything, read and follow `.claude/skills/customer-sandbox/SKILL.md`.**
In short: never push, never switch to or merge into main/develop/epic, never deploy or docker push, never touch `.env` or Dockerfiles.
Commit only on `customer/sandbox` or `customer/<topic>`, and send changes to the team as a `git bundle` instead of pushing.
