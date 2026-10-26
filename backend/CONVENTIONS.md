# Backend conventions (read before writing code)

Plan: `../docs/backend/01-implementation-plan.md`. Shared contract: `../src/shared/contract/*` (import from `@contrack/contract`).
Shared domain: `../src/domain/*` (import from `@contrack/domain/...`, e.g. `@contrack/domain/sync`, `@contrack/domain/project`).

## Layout of a module (`src/modules/<context>/`)
```
domain/
  entities/<name>.entity.ts            aggregate roots / entities (class, private constructor, static create + rehydrate)
  value-objects/<name>.value-object.ts immutable, validated in a static `create(raw): Result<VO, DomainError>`
  events/<name>.event.ts               (only when something reacts to it)
  policies/<name>.policy.ts            pure rules that span entities
application/
  ports/<name>.repository.ts           abstract class = port AND Nest DI token
  ports/<name>.port.ts                 other outbound ports (hasher, token signer, …)
  use-cases/<verb-noun>.use-case.ts    one class per use case: @Injectable, `execute(input): Promise<Result<Out, DomainError>>`
infrastructure/adapters/
  drizzle-<name>.repository.ts         Postgres (uses DatabaseContext.executor — joins the UnitOfWork transaction)
  in-memory-<name>.repository.ts       same contract, Map-based (unit tests, e2e, PERSISTENCE=memory)
  <other>.adapter.ts
presentation/
  <name>.controller.ts / <name>.gateway.ts
  <name>.mapper.ts                     entity → contract DTO (dates → ISO strings)
<context>.module.ts                    @Global() @Module: providers + exports of the ports other modules use
```
Spec files sit next to the file they test: `register-user.use-case.spec.ts`.

## Rules
- **Dependency direction**: presentation → application → domain. Domain imports nothing from Nest, Drizzle or other modules.
  Infrastructure implements application ports. Other modules are reached only through `src/shared/application/ports.ts`.
- **No CQRS**: no command/query buses or sagas. Controllers call use cases directly.
- **Expected failures are `Result`** (`src/shared/domain/result.ts`) with a `DomainError` whose `code` comes from the
  contract. Throw only for bugs. Controllers return `unwrap(await useCase.execute(...))`.
- **Branded ids** (`src/shared/domain/ids.ts`) everywhere in domain/application. Parse route params with `parseId`.
- **Validation at the edge** with the contract's zod schemas: `@Body(new ZodPipe(createProjectRequestSchema)) body: CreateProjectRequest`.
  Responses are typed with the contract DTO types (`Promise<ProjectDto>`).
- **Authorization inside use cases**: resolve the caller's role (`WorkspaceAccess.roleOf`) and check
  `can(role, '<permission>')` (`src/shared/domain/permissions.ts`). Not a member → `DomainError.notFound(...)`
  (never reveal that another tenant's thing exists). Member without permission → `DomainError.forbidden()`.
- **Tenant isolation in queries**: every Drizzle query on tenant tables filters by `workspace_id` (and project id).
- **Transactions**: use cases that write more than one row wrap the writes in `this.uow.run(async () => { … })`.
  Realtime publishing happens **after** `run` returns (after commit).
- **Time and ids** come from `Clock` and `IdGenerator` (tests use `FixedClock` / `SequentialIdGenerator`).
- **Persistence switch**: register repositories with `persistence(Port, () => new InMemoryX(), ctx => new DrizzleX(ctx))`
  from `src/shared/infrastructure/core.module.ts`.
- TypeScript strict + `noUncheckedIndexedAccess`; no `any`, no `!` non-null assertions in src (allowed in specs),
  no `||` for defaults (`??`), `import type` for types. Lint: `npm run lint`. Types: `npm run typecheck`.
- Files: kebab-case. Classes: `RegisterUserUseCase`, `DrizzleUserRepository`, `InMemoryUserRepository`, `Email`.

## Tests
- Unit (`npm test`, `src/**/*.spec.ts`): entities, value objects, policies, every use case (happy path + every error
  branch + authorization per role) with in-memory adapters, `FixedClock`, `SequentialIdGenerator`.
- E2E (`npm run test:e2e`, `test/e2e/*.e2e-spec.ts`): `createApp({ env: testEnv() })` + supertest / socket.io-client.
- Integration (`npm run test:int`, `test/integration/*.int-spec.ts`): Drizzle adapters on `TEST_DATABASE_URL`;
  use `describeIfDatabase` from `test/support/database.ts` so suites skip when no database is reachable.
