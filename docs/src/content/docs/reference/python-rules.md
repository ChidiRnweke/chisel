---
title: Python rules
description: Every rule enforced by `chisel`, grouped by category, with fix guidance.
sidebar:
  # Pin order so the reference sidebar stays stable across releases.
  order: 3
tableOfContents:
  minHeadingLevel: 2
  maxHeadingLevel: 3
---

:::note[Snapshot]
This page mirrors `scripts/data/py-rules.json` captured at release time. Run `chisel rules --json` to see the live list for your installed version.
:::

58 rules across 10 categories, enforced by `chisel`.

## App File

`app-file` · 3 rules

### `app-file:app-loc-limit`

app.py exceeds 50 lines of code

**Fix.** app.py should contain only create_app() and the lifespan context. Move everything else into the appropriate layer.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `app-file:route-in-app`

Route definition inside app.py

**Fix.** app.py only creates the app and registers routers. Move this route into routes/ and register it via app.include_router().

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `app-file:app-complexity-limit`

app.py cyclomatic complexity exceeds 1

**Fix.** app.py should contain only create_app() and the lifespan context. Move everything else into the appropriate layer.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

## Complexity

`complexity` · 5 rules

### `complexity:app-loc-limit`

app.py exceeds 50 lines of code

**Fix.** app.py should contain only create_app() and the lifespan context. Move everything else into the appropriate layer.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `complexity:route-loc-limit`

Route handler exceeds 20 lines of code

**Fix.** Route handlers parse input, call the factory, return output — nothing else. Move anything else into a controller or service.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `complexity:controller-loc-limit`

Controller method exceeds 30 lines of code

**Fix.** Controllers orchestrate — they don't contain logic. Extract business logic into a service or split concerns across services composed with asyncio.TaskGroup.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `complexity:controller-complexity-limit`

Controller method cyclomatic complexity exceeds 3

**Fix.** Controllers orchestrate — they don't contain logic. Extract business logic into a service or split concerns across services composed with asyncio.TaskGroup.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `complexity:factory-complexity-limit`

Factory cyclomatic complexity exceeds 1

**Fix.** The factory wires dependencies and makes no decisions. Move the conditional logic into a service method.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

## Concurrency

`concurrency` · 1 rule

### `concurrency:asyncio-gather-banned`

asyncio.gather() used

**Fix.** Replace with asyncio.TaskGroup. TaskGroup cancels sibling tasks on failure and propagates exceptions cleanly.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

## Config Startup

`config-startup` · 1 rule

### `config-startup:getenv-outside-config`

os.getenv() called outside config.py

**Fix.** All environment variables are read once at startup in Config.from_env(). Access config values via the injected config instance.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

## Error Flow

`error-flow` · 1 rule

### `error-flow:http-in-error`

HTTP status code in a domain error class

**Fix.** Remove the status code from the error class. The mapping from domain error to HTTP status lives exclusively in error_handlers.py.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

## Import Boundary

`import-boundary` · 8 rules

### `import-boundary:layer-no-internal-imports`

Layer importing from code it must not depend on

**Fix.** Models are pure data with no dependencies. If you need logic that uses a service or repository, it belongs in a service method.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `import-boundary:layer-banned-import`

Layer importing from a banned layer

**Fix.** Layer boundary violated. Services never directly import controllers, routes, or other services. Wire dependencies through the factory using Protocol interfaces.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `import-boundary:banned-module`

Service importing SQLAlchemy or other banned module

**Fix.** Services never touch the database. Move the query into a repository method and inject the repository into the service.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `import-boundary:fastapi-location`

fastapi imported outside app.py, routes/, dependencies.py, or error_handlers.py

**Fix.** FastAPI imports mean HTTP concerns are leaking into the domain. Move the FastAPI-specific code to a route handler or dependency.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `import-boundary:sqlalchemy-location`

sqlalchemy imported outside repositories/ or factory.py

**Fix.** Services never touch the database. Move the query into a repository method and inject the repository into the service.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `import-boundary:async-session-location`

sqlalchemy.ext.asyncio imported outside repositories/, factory.py, or dependencies.py

**Fix.** The session is request-scoped. Create it in dependencies.py, pass it through the factory, and use it inside repositories.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `import-boundary:factory-import-location`

factory.py imported outside routes/ or dependencies.py

**Fix.** The factory belongs in routes and dependencies only. Thread services through as Protocol-typed parameters everywhere else.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `import-boundary:orm-leak`

ORM type imported outside repositories/

**Fix.** ORM types never leave the repository layer. Call _to_domain() inside the repository and return a domain model.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

## Project Structure

`project-structure` · 8 rules

### `project-structure:src-layout-missing`

Project does not use src layout

**Fix.** All application code lives under the src layout. Create src/<appname>/ and move all .py files there.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `project-structure:root-py-file`

.py file found at project root

**Fix.** All application code lives under the src layout. Move this file into src/<appname>/.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `project-structure:src-root-py-file`

.py file found at src/ root

**Fix.** All application code lives under the src layout. Move this file into src/<appname>/.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `project-structure:setup-py-banned`

setup.py found in project

**Fix.** Use pyproject.toml exclusively. Remove setup.py and consolidate dependencies there.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `project-structure:requirements-txt-banned`

requirements.txt found in project

**Fix.** Use pyproject.toml exclusively. Remove requirements.txt and consolidate dependencies there.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `project-structure:pyproject-missing`

pyproject.toml not found

**Fix.** pyproject.toml is required as the single build configuration file.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `project-structure:orm-init-empty`

ORM __init__.py has no imports

**Fix.** repositories/orm/__init__.py must import all ORM models for Alembic autogeneration.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `project-structure:missing-test-coverage`

Service or controller has no corresponding test file

**Fix.** Add a test file under tests/unit/ covering its core invariants.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

## Session

`session` · 1 rule

### `session:session-execute-location`

session.execute() called outside repositories/

**Fix.** Extract the query into a repository method, add it to IYourRepository, and call it from there.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

## Structural

`structural` · 25 rules

### `structural:import-not-at-top`

All imports must be at the top of the file

**Fix.** Use the module-level structlog logger instead. print() has no log level and doesn't appear in your observability stack.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:import-not-at-top-nested`

Import statements inside functions, methods, or blocks

**Fix.** Import statements inside functions, methods, or blocks are banned — move them to the top of the file.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:getattr-setattr-banned`

getattr() or setattr() used in application code

**Fix.** Add the attribute to the Protocol interface or use an explicit typed constructor. Dynamic attribute access erases the type system.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:isinstance-banned`

isinstance() used in application code

**Fix.** Use match/case for type-based branching. In error handlers the match exc: pattern already handles it. Elsewhere, isinstance checks usually mean logic that belongs on the domain object itself.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:class-attribute-banned`

__class__ attribute access in application code

**Fix.** Metaprogramming via __class__ is banned. Use match/case for type-based branching instead.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:percent-interpolation-banned`

Percent (%) string interpolation used

**Fix.** Use f-strings for application strings. For logger calls use structured keyword arguments: logger.info('message', key=value).

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:logger-fstring`

f-string passed to a logger call

**Fix.** Pass context as keyword arguments, not interpolated strings. Replace logger.info(f'Created {x}') with logger.info('Created item', id=x).

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:print-banned`

print() called in src/

**Fix.** Use the module-level structlog logger instead. print() has no log level and doesn't appear in your observability stack.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:non-dataclass-in-layer`

Class in services/, controllers/, or repositories/ is not a @dataclass

**Fix.** Add @dataclass(slots=True) and declare dependencies as typed fields. This makes dependencies explicit and injectable.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:dataclass-no-slots`

@dataclass without slots=True

**Fix.** Dataclasses must use slots=True for performance and memory efficiency.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:dataclass-no-frozen`

@dataclass in models/ without frozen=True

**Fix.** Value objects and output models in models/ must use frozen=True to ensure immutability.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:misplaced-dataclass`

@dataclass with zero methods in services/, controllers/, or repositories/

**Fix.** This is a model, not a service/controller/repository. Move it to models/.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:logger-dataclass-field`

logger defined as a dataclass field

**Fix.** The logger is a module-level constant, not a dependency. Move it outside the class: logger = structlog.getLogger(__name__).

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:app-error-direct-raise`

AppError raised directly

**Fix.** Raise a named subclass instead: raise NotFoundError(...). Define new errors in errors.py if needed.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:app-error-http-status`

HTTP status code in a domain error class

**Fix.** Remove the status code from the error class. The mapping from domain error to HTTP status lives exclusively in error_handlers.py.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:try-except-routes`

try/except inside a route handler

**Fix.** Route handlers don't catch exceptions — error_handlers.py does. Remove the try/except and let the exception propagate.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:factory-no-staticmethod`

@staticmethod on AppFactory or CheckerFactory

**Fix.** The factory is instantiated per-request and carries session and user context. Make it a regular instance method.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:factory-zero-logic`

Conditional logic in AppFactory or CheckerFactory

**Fix.** The factory wires dependencies and makes no decisions. Move the conditional logic into a service method.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:bare-column-banned`

Bare Column() used instead of Mapped[T] in ORM models

**Fix.** Use Mapped[T] for ORM column types instead of bare Column().

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:missing-protocol`

Service implementation has no corresponding Protocol

**Fix.** Define an IYourService Protocol in the same file. Controllers and the factory depend on the interface, not the concrete class.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:http-exception-location`

HTTPException imported outside error_handlers.py

**Fix.** HTTPExceptions must only appear in error_handlers.py. Raise a domain error from errors.py instead and map it to HTTP status in the error handler.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:match-case-location`

match/case used outside error_handlers.py

**Fix.** match/case is only allowed in error_handlers.py for exception type branching. Use if/elif everywhere else.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:toplevel-function-in-service`

Top-level standalone function in services/

**Fix.** Services must be @dataclass classes, not standalone functions. Move this function into a service class.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:status-code-location`

status imported from fastapi/starlette outside error_handlers.py

**Fix.** HTTP status codes must only appear in error_handlers.py. Raise a domain error and map it to HTTP status in the error handler.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

### `structural:concrete-service-import`

Concrete service class imported outside factory.py or controllers/

**Fix.** Factories and controllers assemble concrete implementations. Import the Protocol interface everywhere else.

:::tip[Skill]
Taught by `building-python-backend`. Run `chisel setup --target <target>` to install it.
:::

## Test Structure

`test-structure` · 5 rules

### `test-structure:test-file-location`

Test file outside tests/unit/, tests/integration/, or tests/e2e/

**Fix.** Move into the correct directory. Unit tests in tests/unit/, repository tests in tests/integration/, full-stack tests in tests/e2e/.

:::tip[Skill]
Taught by `qa`. Run `chisel setup --target <target>` to install it.
:::

### `test-structure:one-assert-per-test`

More than one assert in a test function

**Fix.** Split into separate test functions, one per assertion. Name each after the invariant it proves: test_cannot_X, test_returns_Y_when_Z.

:::tip[Skill]
Taught by `qa`. Run `chisel setup --target <target>` to install it.
:::

### `test-structure:test-naming`

Test name does not describe an invariant

**Fix.** Name the test after the invariant it proves: test_cannot_X, test_returns_Y_when_Z, test_detects_X, test_allows_X_under_Y.

:::tip[Skill]
Taught by `qa`. Run `chisel setup --target <target>` to install it.
:::

### `test-structure:skip-without-reason`

@pytest.mark.skip without a reason

**Fix.** Add reason= explaining why this test is skipped and when it should be re-enabled.

:::tip[Skill]
Taught by `qa`. Run `chisel setup --target <target>` to install it.
:::

### `test-structure:banned-import-in-tests`

TestClient, uvicorn, or httpx imported in unit/integration tests

**Fix.** Inject fakes and call the service or controller directly. The factory pattern exists to make this possible without spinning up the app.

:::tip[Skill]
Taught by `qa`. Run `chisel setup --target <target>` to install it.
:::
