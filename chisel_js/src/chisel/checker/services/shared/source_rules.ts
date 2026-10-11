import ts from "typescript";
import type { FileInfo } from "chisel/checker/models/file_info";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { Violation } from "chisel/checker/models/violation";
import { Layer, isBrowserService } from "chisel/checker/models/layer";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { scriptsOf } from "chisel/checker/repositories/file_parser";

/**
 * Source rules: fail loudly, and parse external data at the boundary.
 *
 * Every rule here is about one thing — a value whose type nobody checked, or a
 * failure nobody hears about. Both convert a loud bug into a quiet wrong answer.
 * Parse external data into a narrow type where it enters (remote functions,
 * routes, repositories reading rows, the service that owns a provider), and the
 * code inward of that boundary never has to probe again.
 *
 * They run on application source: everything under `src/` that is not a test.
 * Test files keep their own rules in `test-structure`.
 */

/** Facts the source rules need that the tree cannot tell them. */
export interface SourceRulesOptions {
  /**
   * The module every icon must come from, such as `$lib/components/icons`.
   * When set, importing an icon library anywhere else is reported.
   */
  readonly icons?: string;
  /**
   * The files allowed to construct agent tools and protocol servers from an
   * agent SDK. Everywhere else, a tool is defined through them.
   */
  readonly toolAdapters?: readonly string[];
}

const ICON_LIBRARY_RE = /^(?:@lucide\/|lucide-|lucide$|@tabler\/icons|phosphor-svelte$|@phosphor-icons\/|@heroicons\/|svelte-hero-icons$|@iconify\/)/;
const AGENT_SDK_MODULES = new Set(["@openai/agents", "@openai/agents-core"]);
const MCP_SERVER_PREFIX = "@modelcontextprotocol/sdk/server/";
const TEST_FILE_RE = /\.(?:spec|test|e2e)\.(?:ts|js)$|\.d\.ts$/;

const unwrap = (value: ts.Expression): ts.Expression => {
  let current = value;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
};

const isCast = (node: ts.Node): node is ts.AsExpression | ts.TypeAssertion =>
  ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);

// ---------------------------------------------------------------------------
// Models hold data
// ---------------------------------------------------------------------------

/** Model callables construct schemas or records; calculations belong to services. */
const schemaExpression = (expression: ts.Expression): boolean => {
  let value = unwrap(expression);
  while (ts.isCallExpression(value) || ts.isPropertyAccessExpression(value)) {
    if (ts.isCallExpression(value)) {
      if (
        ts.isPropertyAccessExpression(value.expression)
        && ["parse", "safeParse", "parseAsync", "safeParseAsync"].includes(value.expression.name.text)
      ) return false;
      value = value.expression;
    } else value = value.expression;
  }
  return ts.isIdentifier(value) && value.text === "z";
};

const dataExpression = (expression: ts.Expression): boolean => {
  const value = unwrap(expression);
  if (
    ts.isIdentifier(value)
    || ts.isLiteralExpression(value)
    || value.kind === ts.SyntaxKind.TrueKeyword
    || value.kind === ts.SyntaxKind.FalseKeyword
    || value.kind === ts.SyntaxKind.NullKeyword
  ) return true;
  if (ts.isArrayLiteralExpression(value)) return value.elements.every(dataExpression);
  if (!ts.isObjectLiteralExpression(value)) return false;
  return value.properties.every(property =>
    ts.isShorthandPropertyAssignment(property)
    || (ts.isPropertyAssignment(property)
      && !ts.isComputedPropertyName(property.name)
      && dataExpression(property.initializer)));
};

// A function, not a constant: modules are loaded by `chisel-js rules`, which must
// not need the compiler to be importable.
const scalarKind = (kind: ts.SyntaxKind): boolean =>
  kind === ts.SyntaxKind.StringKeyword
  || kind === ts.SyntaxKind.NumberKeyword
  || kind === ts.SyntaxKind.BigIntKeyword;

/** Scalar constructors may validate and spell a branded value, but cannot consult collaborators. */
const valueConstructor = (
  callable: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
): boolean => {
  if (!callable.type || !ts.isTypeReferenceNode(callable.type) || !callable.body) return false;
  const name = callable.type.typeName.getText();
  const declaration = callable.getSourceFile().statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === name,
  );
  if (!declaration || !ts.isIntersectionTypeNode(declaration.type)) return false;
  const scalar = declaration.type.types.find(type => scalarKind(type.kind));
  const brand = declaration.type.types.find(type =>
    ts.isTypeLiteralNode(type)
    && type.members.length === 1
    && type.members.every(member =>
      ts.isPropertySignature(member)
      && member.name.getText() === "__brand"
      && member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
      && member.type !== undefined
      && ts.isLiteralTypeNode(member.type)
      && ts.isStringLiteral(member.type.literal)));
  if (!scalar || !brand || declaration.type.types.length !== 2) return false;

  const locals = new Set<string>();
  for (const parameter of callable.parameters) {
    if (!ts.isIdentifier(parameter.name) || !parameter.type || !scalarKind(parameter.type.kind)) {
      return false;
    }
    locals.add(parameter.name.text);
  }
  const expression = (input: ts.Expression): boolean => {
    const value = unwrap(input);
    if (ts.isIdentifier(value)) return locals.has(value.text);
    if (ts.isLiteralExpression(value)) return true;
    if (ts.isAsExpression(value)) return value.type.getText() === name && expression(value.expression);
    if (ts.isTemplateExpression(value)) return value.templateSpans.every(span => expression(span.expression));
    if (ts.isBinaryExpression(value)) {
      return !(value.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
        && value.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
        && expression(value.left)
        && expression(value.right);
    }
    if (ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression)) {
      const receiver = value.expression.expression;
      return ts.isIdentifier(receiver)
        && locals.has(receiver.text)
        && ["indexOf", "includes", "slice", "trim", "toLowerCase", "toUpperCase", "toString"]
          .includes(value.expression.name.text)
        && value.arguments.every(expression);
    }
    return false;
  };
  if (callable.parameters.some(parameter => parameter.initializer && !expression(parameter.initializer))) {
    return false;
  }
  const statement = (node: ts.Statement): boolean => {
    if (ts.isBlock(node)) return node.statements.every(statement);
    if (ts.isReturnStatement(node)) return !!node.expression && expression(node.expression);
    if (ts.isIfStatement(node)) {
      return expression(node.expression)
        && statement(node.thenStatement)
        && (!node.elseStatement || statement(node.elseStatement));
    }
    if (ts.isThrowStatement(node)) {
      return ts.isNewExpression(node.expression)
        && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === "Error"
        && !!node.expression.arguments?.every(expression);
    }
    if (ts.isVariableStatement(node) && (node.declarationList.flags & ts.NodeFlags.Const) !== 0) {
      return node.declarationList.declarations.every(local => {
        if (!ts.isIdentifier(local.name) || !local.initializer || !expression(local.initializer)) return false;
        locals.add(local.name.text);
        return true;
      });
    }
    return false;
  };
  return ts.isBlock(callable.body) ? statement(callable.body) : expression(callable.body);
};

const modelProcedure = (node: ts.Node): boolean => {
  let callable: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
  if (ts.isFunctionDeclaration(node) && ts.isSourceFile(node.parent)) callable = node;
  else if (
    ts.isVariableDeclaration(node)
    && node.initializer
    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    && ts.isVariableDeclarationList(node.parent)
    && ts.isVariableStatement(node.parent.parent)
    && ts.isSourceFile(node.parent.parent.parent)
  ) callable = node.initializer;
  else return false;
  if (valueConstructor(callable)) return false;
  const body = callable.body;
  if (!body) return false;
  let expression: ts.Expression | undefined;
  if (ts.isBlock(body)) {
    const last = body.statements.at(-1);
    const schemaLocals = body.statements.slice(0, -1).every(statement =>
      ts.isVariableStatement(statement)
      && (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
      && statement.declarationList.declarations.every(declaration =>
        declaration.initializer !== undefined && schemaExpression(declaration.initializer)));
    if (schemaLocals && last && ts.isReturnStatement(last)) expression = last.expression;
  } else expression = body;
  return !expression
    || !(schemaExpression(expression)
      || (ts.isObjectLiteralExpression(unwrap(expression)) && dataExpression(expression)));
};

const modelState = (node: ts.Node): boolean =>
  ts.isClassDeclaration(node)
  || (ts.isVariableStatement(node)
    && ts.isSourceFile(node.parent)
    && (node.declarationList.flags & ts.NodeFlags.Const) === 0);

// ---------------------------------------------------------------------------
// Narrowing
// ---------------------------------------------------------------------------

/**
 * A type assertion onto an object literal. `value as never` on a single value
 * is fine — the reader sees the one thing being asserted. `{ … } as T` turns
 * off field-by-field checking for a shape nobody verified.
 */
const shapeCast = (node: ts.Node): boolean =>
  isCast(node)
  && node.type.getText() !== "const"
  && (ts.isObjectLiteralExpression(unwrap(node.expression))
    || (node.type.kind === ts.SyntaxKind.NeverKeyword
      && !ts.isPropertyAccessExpression(unwrap(node.expression))
      && !ts.isElementAccessExpression(unwrap(node.expression)))
    || (node.type.kind === ts.SyntaxKind.UnknownKeyword && isCast(node.parent)));

const responseJsonCast = (node: ts.Node): boolean => {
  if (!isCast(node)) return false;
  if (node.type.kind === ts.SyntaxKind.UnknownKeyword) return false;
  let expression = unwrap(node.expression);
  if (ts.isAwaitExpression(expression)) expression = unwrap(expression.expression);
  return ts.isCallExpression(expression)
    && ts.isPropertyAccessExpression(expression.expression)
    && expression.expression.name.text === "json";
};

const jsonParseCall = (node: ts.Node): boolean =>
  ts.isCallExpression(node)
  && ts.isPropertyAccessExpression(node.expression)
  && ts.isIdentifier(node.expression.expression)
  && node.expression.expression.text === "JSON"
  && node.expression.name.text === "parse";

const enclosingReturnType = (node: ts.Node): ts.TypeNode | undefined => {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) return current.type;
    current = current.parent;
  }
  return undefined;
};

/** The type an expression is handed to, in each position where a human wrote one down. */
const declaredTarget = (node: ts.Node): ts.TypeNode | undefined => {
  let current: ts.Node = node;
  while (current.parent && ts.isParenthesizedExpression(current.parent)) current = current.parent;
  const parent: ts.Node | undefined = current.parent;
  if (!parent) return undefined;
  if (isCast(parent) && parent.expression === current) return parent.type;
  if ((ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent)) && parent.initializer === current) {
    return parent.type;
  }
  if (ts.isArrowFunction(parent) && parent.body === current) return parent.type;
  if (ts.isReturnStatement(parent)) return enclosingReturnType(parent);
  return undefined;
};

/**
 * A `JSON.parse` result given a type nothing checked: a cast, an annotated
 * declaration, or an annotated return. `as unknown`, `: unknown` and a result
 * handed straight to a schema are the honest forms. Reported at the call, the
 * one node present in all three positions, so a suppression can sit above it.
 */
const jsonParseCast = (node: ts.Node): boolean => {
  if (!jsonParseCall(node)) return false;
  const target = declaredTarget(node);
  return target !== undefined && target.kind !== ts.SyntaxKind.UnknownKeyword;
};

/**
 * A cast onto an inline object type — the mirror of `shape-cast`. A union arm
 * counts (`as { words(): number } | undefined`); a mapped type and an array of
 * type literals do not, since neither asserts a shape onto a foreign value.
 */
const castProbe = (node: ts.Node): boolean => {
  if (!isCast(node) || ts.isObjectLiteralExpression(unwrap(node.expression))) return false;
  if (ts.isTypeLiteralNode(node.type)) return true;
  return ts.isUnionTypeNode(node.type) && node.type.types.some(type => ts.isTypeLiteralNode(type));
};

/** `Record<string, unknown>`, `Record<string, any>`, or `{ [k: string]: unknown }`. */
const weakRecordType = (node: ts.TypeNode): boolean => {
  const weakValue = (type: ts.TypeNode | undefined): boolean =>
    type?.kind === ts.SyntaxKind.UnknownKeyword || type?.kind === ts.SyntaxKind.AnyKeyword;
  if (ts.isTypeReferenceNode(node)) {
    return ts.isIdentifier(node.typeName)
      && node.typeName.text === "Record"
      && node.typeArguments?.length === 2
      && weakValue(node.typeArguments[1]);
  }
  if (!ts.isTypeLiteralNode(node)) return false;
  return node.members.length > 0
    && node.members.every(member => ts.isIndexSignatureDeclaration(member) && weakValue(member.type));
};

/** The same open-keyed record, also through a `Readonly<…>` wrapper. */
const weakRecordTypeRef = (node: ts.TypeNode): boolean => {
  if (
    ts.isTypeReferenceNode(node)
    && ts.isIdentifier(node.typeName)
    && node.typeName.text === "Readonly"
    && node.typeArguments?.length === 1
  ) return weakRecordTypeRef(node.typeArguments[0]!);
  return weakRecordType(node);
};

/**
 * A predicate that claims to narrow into an open-keyed record. Detected by its
 * signature, never by its name: `isRecord` and `isPlainObject` are the same
 * function.
 */
const weakRecordGuard = (node: ts.Node): boolean => {
  if (
    !ts.isFunctionDeclaration(node)
    && !ts.isArrowFunction(node)
    && !ts.isFunctionExpression(node)
    && !ts.isMethodDeclaration(node)
  ) return false;
  return node.type !== undefined
    && ts.isTypePredicateNode(node.type)
    && node.type.type !== undefined
    && weakRecordType(node.type.type);
};

const insideCastTarget = (node: ts.Node): boolean => {
  let current: ts.Node = node;
  while (current.parent) {
    if (isCast(current.parent) && current.parent.type === current) return true;
    current = current.parent;
  }
  return false;
};

/**
 * `unknown` in a position another piece of code has to read: a parameter, a
 * return type, a field or a type alias, also through a union, an array or a
 * generic argument. A cast target (`x as unknown`) and a local annotation
 * (`const parsed: unknown = JSON.parse(text)`) are the honest forms: the next
 * line narrows them.
 */
const unknownTypePosition = (node: ts.Node): boolean => {
  if (node.kind !== ts.SyntaxKind.UnknownKeyword || insideCastTarget(node)) return false;
  let current: ts.Node = node;
  while (current.parent && ts.isTypeNode(current.parent)) current = current.parent;
  const parent: ts.Node | undefined = current.parent;
  if (!parent || ts.isVariableDeclaration(parent)) return false;
  if (ts.isParameter(parent) || ts.isTypeAliasDeclaration(parent)) return true;
  if (ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent)) return true;
  return ts.isFunctionLike(parent) && parent.type === current;
};

// ---------------------------------------------------------------------------
// Fail loudly
// ---------------------------------------------------------------------------

/** `return { kind: 'error' | 'failure' | 'corrupt', … }` or `return { ok: false, … }`. */
const explicitFailureResult = (node: ts.ReturnStatement): boolean => {
  const expression = node.expression && unwrap(node.expression);
  if (!expression || !ts.isObjectLiteralExpression(expression)) return false;
  return expression.properties.some(field => {
    if (!ts.isPropertyAssignment(field) || !ts.isIdentifier(field.name)) return false;
    if (field.name.text === "ok") return field.initializer.kind === ts.SyntaxKind.FalseKeyword;
    return field.name.text === "kind"
      && (ts.isStringLiteral(field.initializer) || ts.isNoSubstitutionTemplateLiteral(field.initializer))
      && ["corrupt", "error", "failure"].includes(field.initializer.text);
  });
};

/** A handler recovers by rethrowing or by returning a failure the caller must read. */
const recovers = (node: ts.Node): boolean => {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (child !== node && ts.isFunctionLike(child)) return;
    if (ts.isThrowStatement(child) || (ts.isReturnStatement(child) && explicitFailureResult(child))) {
      found = true;
    }
    if (!found) ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
};

const rejectionHandler = (node: ts.CallExpression): ts.Expression | undefined => {
  if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
  if (node.expression.name.text === "catch") return node.arguments[0];
  if (node.expression.name.text === "then") return node.arguments[1];
  return undefined;
};

// ---------------------------------------------------------------------------

export class SourceRulesService {
  readonly ruleIdPrefix = "source";

  constructor(private readonly options: SourceRulesOptions = {}) {}

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.path.startsWith("src/")) continue;
      if (file.language === "js" || TEST_FILE_RE.test(file.path)) continue;
      if (file.source === "") continue;
      violations.push(...this._checkFile(file));
    }
    return violations;
  }

  private _checkFile(file: FileInfo): Violation[] {
    const violations: Violation[] = [];
    const isModel = file.layer === Layer.MODELS;
    // The layers kept total, inward of every parse zone. A browser service owns
    // the server's answers the way a server service owns its provider's, so it
    // is a parse zone, not a strict layer.
    const strict = isModel
      || file.layer === Layer.CONTROLLERS
      || (file.layer === Layer.SERVICES && !isBrowserService(file.path));

    for (const { sf, offset } of scriptsOf(file.ast)) {
      const zod = zodImports(sf);
      const report = (ruleId: string, node: ts.Node, message: string): void => {
        const line = lineOf(file.source, offset + node.getStart(sf));
        // `Readonly<Record<string, unknown>>` matches at the wrapper and at its
        // argument: one violation per rule and line.
        if (violations.some(v => v.ruleId === ruleId && v.line === line)) return;
        violations.push(createViolation({ file: file.path, line, severity: Severity.ERROR, ruleId, message }));
      };

      const visit = (node: ts.Node): void => {
        if (isModel) {
          if (modelProcedure(node)) {
            report("models:procedure", node,
              "A model implements a procedure. Models construct data and Zod schemas; move the "
              + "calculation to a service.");
          }
          if (modelState(node)) {
            report("models:state", node,
              "A model declares a class or mutable module state. Models are values, types and "
              + "schemas; runtime state belongs in a store, behaviour in a service.");
          }
          if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
            report("models:instanceof", node,
              "A model uses instanceof. Models describe data; discriminate with a tagged union.");
          }
        }
        if (this._toolBoundaryImport(node, file.path)) {
          report("agent:tool-boundary", node,
            "Constructs or re-exports agent tools or a protocol server outside the declared tool "
            + "adapters. Define tools through the adapter, which applies the shared policy.");
        }
        if (this._iconLibraryImport(node)) {
          report("design-system:icon-library", node,
            `Imports an icon library. Every icon comes from ${this.options.icons}.`);
        }
        if (shapeCast(node)) {
          report("narrowing:shape-cast", node,
            "Asserts a type onto an object literal, which turns off field-by-field checking. "
            + "Build the value with its real type, or parse it.");
        }
        if (responseJsonCast(node)) {
          report("narrowing:no-response-json-cast", node,
            "Casts a response's JSON without parsing it. Parse it with the schema of the type "
            + "it should be.");
        }
        if (jsonParseCast(node)) {
          report("narrowing:no-json-parse-cast", node,
            "Names a JSON.parse result with a type nothing checked. Keep it `unknown` and parse "
            + "it with a schema.");
        }
        if (castProbe(node)) {
          report("narrowing:no-cast-probe", node,
            "Asserts an inline object shape onto a value. Parse the value into a named type at "
            + "the boundary instead of probing it.");
        }
        if (isWeakZodCall(node, zod)) {
          report("narrowing:no-zod-unknown", node,
            "A z.unknown() or z.any() schema narrows nothing. Describe the value's real shape.");
        }
        if (weakRecordGuard(node)) {
          report("narrowing:no-weak-record-guard", node,
            "A guard narrows to an open-keyed record instead of a type, so everything after it "
            + "still has to probe. Parse into the concrete type.");
        }
        if (ts.isTypeNode(node) && weakRecordTypeRef(node)) {
          report("narrowing:no-record-unknown", node,
            "Uses an open-keyed record of unknown as a struct. Name the fields, or parse into a "
            + "type that does.");
        }
        if (strict && unknownTypePosition(node)) {
          report("narrowing:no-unknown-type", node,
            "Leaves `unknown` on a type inward of a parse zone. Models, services and controllers "
            + "receive narrow values; parse where the data enters.");
        }
        if (ts.isCatchClause(node) && !recovers(node.block)) {
          report("fail-loudly:silent-catch", node,
            "A catch absorbs the failure. Rethrow, or return an explicit failure result "
            + "(`kind: 'error' | 'failure' | 'corrupt'`) the caller has to read. A log alone is "
            + "not a recovery.");
        }
        if (ts.isCallExpression(node)) {
          const handler = rejectionHandler(node);
          if (handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) && !recovers(handler.body)) {
            report("fail-loudly:silent-catch", node,
              "A promise rejection handler absorbs the failure. Rethrow, or return an explicit "
              + "failure result the caller has to read.");
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    return violations;
  }

  /**
   * Agent tools and protocol servers are constructed in the declared adapters
   * only. A type-only import is not construction.
   */
  private _toolBoundaryImport(node: ts.Node, path: string): boolean {
    if ((this.options.toolAdapters ?? []).includes(path)) return false;
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (!clause || clause.isTypeOnly) return false;
      const module = node.moduleSpecifier.text;
      const bindings = clause.namedBindings;
      const constructors = module.startsWith(MCP_SERVER_PREFIX)
        ? ["Server", "McpServer"]
        : AGENT_SDK_MODULES.has(module) ? ["tool"] : undefined;
      if (constructors === undefined || bindings === undefined) return false;
      return ts.isNamespaceImport(bindings)
        || bindings.elements.some(binding =>
          !binding.isTypeOnly && constructors.includes(binding.propertyName?.text ?? binding.name.text));
    }
    if (
      ts.isExportDeclaration(node)
      && !node.isTypeOnly
      && node.moduleSpecifier !== undefined
      && ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const module = node.moduleSpecifier.text;
      if (!AGENT_SDK_MODULES.has(module) && !module.startsWith(MCP_SERVER_PREFIX)) return false;
      return !node.exportClause
        || ts.isNamespaceExport(node.exportClause)
        || node.exportClause.elements.some(binding =>
          !binding.isTypeOnly
          && ["tool", "Server", "McpServer"].includes(binding.propertyName?.text ?? binding.name.text));
    }
    return false;
  }

  private _iconLibraryImport(node: ts.Node): boolean {
    if (this.options.icons === undefined) return false;
    return (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier !== undefined
      && ts.isStringLiteral(node.moduleSpecifier)
      && ICON_LIBRARY_RE.test(node.moduleSpecifier.text);
  }

  describeRules(): RuleInfo[] {
    const rule = (id: string, description: string, fixGuidance: string): RuleInfo => ({
      id,
      category: id.split(":", 1)[0]!,
      description,
      fixGuidance,
    });
    return [
      rule("fail-loudly:silent-catch",
        "A catch or rejection handler that neither rethrows nor returns a failure result",
        "Rethrow, or return an object whose `kind` is 'error', 'failure' or 'corrupt' (or "
        + "`ok: false`) so the caller decides. Add a log or toast as well where someone needs "
        + "to know; it never counts as the recovery. Suppress only where the recovery reports "
        + "itself somewhere the type cannot show, and name where."),
      rule("narrowing:shape-cast",
        "A type assertion onto an object literal",
        "Construct the value with its real type, or parse it. `value as never` on one branded "
        + "value is fine; `{ … } as T` hides every missing field."),
      rule("narrowing:no-cast-probe",
        "A cast onto an inline object type (`x as { a?: unknown }`)",
        "Parse the value into a named type at the boundary instead of probing its fields."),
      rule("narrowing:no-json-parse-cast",
        "A JSON.parse result given a type nothing checked",
        "Annotate it `unknown` and parse it with a schema that produces the type."),
      rule("narrowing:no-response-json-cast",
        "A response JSON result cast without parsing",
        "Parse `await response.json()` with the schema of the type it should be."),
      rule("narrowing:no-record-unknown",
        "`Record<string, unknown>` or an `unknown` index signature used as a struct",
        "Name the fields the code reads, or parse into a type that does."),
      rule("narrowing:no-weak-record-guard",
        "A type predicate that narrows to an open-keyed record",
        "Parse into the concrete type. A guard to `Record<string, unknown>` leaves every "
        + "caller probing."),
      rule("narrowing:no-zod-unknown",
        "A z.unknown() or z.any() schema",
        "Describe the shape. A schema that accepts anything narrows nothing."),
      rule("narrowing:no-unknown-type",
        "`unknown` on a parameter, return, field or alias in a model, service or controller",
        "Parse at the boundary — remote functions, routes, repositories, the service that owns "
        + "a provider, browser services — so the layers inward receive narrow types."),
      rule("models:procedure",
        "A model function that computes instead of constructing data or a schema",
        "Move the calculation to a service. Models hold values, types, schemas and "
        + "constructors; a branded-scalar constructor may validate its input."),
      rule("models:state",
        "A class or mutable module state in a model",
        "Models are data. Runtime state belongs in a store, behaviour in a service."),
      rule("models:instanceof",
        "instanceof in a model",
        "Discriminate with a tagged union; models carry no classes to test against."),
      rule("agent:tool-boundary",
        "An agent tool or protocol server constructed outside the declared tool adapters",
        "Build tools through the adapter listed in `agent.toolAdapters`, which applies the "
        + "shared approval and feedback policy."),
      rule("design-system:icon-library",
        "An icon library imported instead of the project's own icon set",
        "Import the icon from the module named in `designSystem.icons`. Component generators "
        + "write library imports into what they add; replace them."),
    ];
  }
}

interface ZodImports {
  readonly namespaces: ReadonlySet<string>;
  readonly weakFunctions: ReadonlySet<string>;
}

function zodImports(sf: ts.SourceFile): ZodImports {
  const namespaces = new Set<string>();
  const weakFunctions = new Set<string>();
  for (const statement of sf.statements) {
    if (
      !ts.isImportDeclaration(statement)
      || !ts.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== "zod"
      || !statement.importClause
    ) continue;
    if (statement.importClause.name) namespaces.add(statement.importClause.name.text);
    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) {
      for (const binding of bindings.elements) {
        const imported = binding.propertyName?.text ?? binding.name.text;
        if (imported === "z") namespaces.add(binding.name.text);
        if (imported === "unknown" || imported === "any") weakFunctions.add(binding.name.text);
      }
    }
  }
  return { namespaces, weakFunctions };
}

function isWeakZodCall(node: ts.Node, zod: ZodImports): boolean {
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression)) return zod.weakFunctions.has(node.expression.text);
  return ts.isPropertyAccessExpression(node.expression)
    && ts.isIdentifier(node.expression.expression)
    && zod.namespaces.has(node.expression.expression.text)
    && (node.expression.name.text === "unknown" || node.expression.name.text === "any");
}

function lineOf(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}
