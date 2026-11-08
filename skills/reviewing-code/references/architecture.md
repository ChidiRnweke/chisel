# Architecture

## The closed set of layers

| Layer        | Holds                                                                                         | May depend on                          | Never                                                             |
| ------------ | --------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Models       | Values, types, schemas, constructors of values                                                | Other models                           | Behaviour, business rules, I/O                                    |
| Services     | One cohesive capability: rules, and the I/O it owns (its repositories, its external provider) | Models, its own repositories/providers | Other services, controllers, global state                         |
| Repositories | Persistence only: domain types in, domain types out; parse the rows they read                 | Models, the database client            | Business rules, other repositories' tables for decisions          |
| Controllers  | Complete operations: sequence services, own transactions                                      | Services (through interfaces), models  | Repositories, other controllers, parsing                          |
| Factories    | Construct and connect; expose interfaces                                                      | Everything they wire                   | Run workflows, branch on business state, expose mutable internals |
| Entry points | Parse external input into models, call one controller operation, shape the response           | Controllers, models                    | Business rules, sequencing several operations                     |

UI applications add:

| Layer      | Holds                                                                                                               | Never                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Stores     | Reactive state with controlled updates                                                                              | Fetching, retrying, provider calls, business decisions     |
| Components | Rendering and user interaction; call controllers for local sequencing and server entry points for server operations | Calling services directly, assembling multi-step workflows |

Rules that follow:

- **No extra layers.** "Adapters", "managers", "helpers", "utils" folders that hold behaviour are a smell. If code does not fit a layer, the abstraction is wrong. An `infrastructure` corner for vendored runtimes (telemetry, schedulers, codecs, SDK constructors) is acceptable when documented in source as such.
- **Services never call services**, not directly, not through injected functions, not through renamed ports or callbacks. A callback does not move ownership.
- **Controllers never call controllers.** Shared sequencing is a service capability or a different cut of the controller.
- **Controllers reach persistence only through services.** Every write has rules around it.
- **Entry points parse; nothing else does.** Request bodies, query strings, tool arguments, provider responses (inside the owning service), stored rows (inside the repository), browser storage (inside its reader). Everything inward receives narrow values.
- **A thin wrapper is not a layer.** If a server operation is already exposed through a parsed entry point (an RPC or remote function), UI code calls it directly. A UI controller exists only where the client really sequences work locally (offline replica, upload pipeline, export rendering, an editor session).

## Services

- A service is a stateless class that explicitly implements one or more narrow capability interfaces. Public members belong to an implemented interface; everything else is private.
- **Cohesion test:** same data or repository, same consumers, same reason to change. Merge one-method classes that share all three into one class implementing all their interfaces. Keep consumers on the narrow interface they need; give a composite interface (`interface Library extends Finder, Writer`) to a controller that needs many.
- **Do not split for size.** Line counts and method counts do not prove a boundary. A class with many unrelated public methods is wrong too.
- **Separate bounded contexts stay separate** even when the mechanism is identical (two ranking pipelines over different data are two services).
- A service that owns an external provider calls it and maps its failures to one domain error carrying the original as `cause`.
- Duplicate methods across sibling classes (three copies of "load for write or throw not-found") mean the classes should be one.
- Capability interfaces and the constructor-dependency type sit beside the service. Data crossing the boundary (inputs, results, value objects) lives in models.

## Composition

- The request's identity (actor, tenant) is bound when the per-request graph is built, never passed to every method. Work across all users uses an explicitly separate system composition.
- Factories build lazily; heavy immutable resources (pools, clients, config) are built once per process.
- Dependencies are interfaces. Never type a dependency as a concrete class, including `Pick<ConcreteClass, ...>` or a type-only import of the class.
- No test knobs in production wiring (no injectable `fetch` "for tests", no override flags). Tests fake whole services.

## State

- Servers are stateless. Anything that outlives an operation is a database row. Client caches go through an explicit sync mechanism, not through server memory.
- Client state has one writer. If several modules write the same replica or store, one module should own the writes and others call it.

## Agents and tools

Apply this section when the project runs an LLM agent with tools.

- The agent controller is a harness over an injected tool list; it knows no specific tool.
- A tool is an entry point: a factory turns one public controller operation into a tool, parses its arguments and projects its result. Tools do not sequence operations or call services; controllers carry no tool vocabulary.
- One unskippable constructor applies the tool feedback policy: every tool error becomes model feedback, only cancellation escapes. Nothing else may construct SDK tools.

## Design style

- Start from value types, discriminated unions and role interfaces (the seams). Then write one total rule function per decision that every caller uses.
- Prefer linear code: input → parse → one rule → one seam → output. Avoid per-caller branching that re-implements the rule.
- Prefer a cheap in-process route over spawning processes or browsers for an external check.
- Decide behaviour once. If two places compute the same thing (UI preview and server write), they share one rule.
