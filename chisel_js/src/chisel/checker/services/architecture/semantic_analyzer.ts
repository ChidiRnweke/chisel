import { dirname, relative, resolve } from "node:path";
import { parse } from "svelte/compiler";
import ts from "typescript";

/**
 * Semantic architecture analysis over the TypeScript program.
 *
 * The import-boundary rules see edges between files. These rules see symbols:
 * which declaration a call actually reaches, through aliases, barrels, namespace
 * imports, wrappers and injected function ports; what a controller operation
 * returns; what a service retains between calls. A type-only import does not
 * hide a concrete dependency, and a callback does not move workflow ownership
 * out of the factory or store that wrote it.
 *
 * Ported from FollowThrough.ai's `scripts/audit-architecture-rules.ts`, where it
 * enforced ADR 0007. The only change is that a file's layer comes from the
 * caller's `layerOf`, so the analysis shares chisel's one layer model.
 */
export type ArchitectureRule =
  | "unresolved-source"
  | "indirect-dependency"
  | "public-service-helper"
  | "service-interface"
  | "concrete-dependency"
  | "controller-collaborator"
  | "controller-orchestration"
  | "controller-repository"
  | "retained-service-state"
  | "store-workflow"
  | "factory-workflow"
  | "tool-operation";
export interface ArchitectureViolation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly rule: ArchitectureRule;
  readonly message: string;
  readonly provenance: readonly string[];
}
export type SemanticLayer =
  | "services"
  | "controllers"
  | "stores"
  | "factories"
  | "tool-factory"
  | "repositories"
  | "remote"
  | "components"
  | "models"
  | "entry"
  | "other";
const modifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some(item => item.kind === kind);
const hidden = (node: ts.Node): boolean =>
  modifier(node, ts.SyntaxKind.PrivateKeyword) ||
  modifier(node, ts.SyntaxKind.ProtectedKeyword) ||
  ("name" in node && !!node.name && ts.isPrivateIdentifier(node.name as ts.Node));
const walk = (node: ts.Node, visit: (node: ts.Node) => void): void => {
  visit(node);
  node.forEachChild(child => walk(child, visit));
};
const walkExecuted = (node: ts.Node, visit: (node: ts.Node) => void): void => {
  if (ts.isFunctionLike(node) || ts.isClassLike(node)) return;
  visit(node);
  node.forEachChild(child => walkExecuted(child, visit));
};
const ancestorClass = (node: ts.Node): ts.ClassLikeDeclaration | undefined => {
  for (let parent = node.parent; parent; parent = parent.parent)
    if (ts.isClassLike(parent)) return parent;
};
const executable = (
  node: ts.Node,
): node is
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration
  | ts.GetAccessorDeclaration =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isGetAccessorDeclaration(node);
const virtualName = (file: string): string =>
  file.endsWith(".svelte") ? `${file}.__architecture.ts` : file;

/** Project symbols, rather than spelling or direct import edges, establish dependency ownership. */
export function analyzeArchitecture(
  files: Readonly<Record<string, string>>,
  root: string,
  compilerOptions: ts.CompilerOptions,
  layer: (file: string) => SemanticLayer,
  isTestCode: (file: string) => boolean,
  isBrowserService: (file: string) => boolean,
): readonly ArchitectureViolation[] {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    paths: { "$lib/*": [resolve(root, "src/lib/*")] },
    types: [],
    ...compilerOptions,
  };
  const host = ts.createCompilerHost(options, true);
  const sources = new Map<string, string>();
  const originals = new Map<string, string>();
  const directories = new Set<string>();
  const violations: ArchitectureViolation[] = [];
  for (const [file, text] of Object.entries(files)) {
    const absolute = resolve(root, virtualName(file));
    originals.set(absolute, file);
    let source = text;
    if (file.endsWith(".svelte")) {
      try {
        const ast = parse(text);
        const scripts = [ast.instance, ast.module].filter(
          script => script !== undefined && script !== null,
        );
        // Preserve offsets so diagnostics refer to the original Svelte source.
        const chars: string[] = text
          .split("")
          .map(char => (char === "\n" || char === "\r" ? char : " "));
        for (const script of scripts) {
          for (let index = script.content.start; index < script.content.end; index++)
            chars[index] = text[index];
        }
        source = `${chars.join("")}\nexport {};`; // Scriptless components are still modules.
        // chisel-ignore fail-loudly:silent-catch -- The failure is reported as architecture:unresolved-source for this file.
      } catch (error) {
        violations.push({
          file,
          line: 1,
          column: 1,
          rule: "unresolved-source",
          message: `Cannot parse Svelte: ${String(error)}`,
          provenance: [],
        });
        continue;
      }
    }
    sources.set(absolute, source);
    for (
      let directory = dirname(absolute);
      directory !== dirname(directory);
      directory = dirname(directory)
    )
      directories.add(directory);
  }
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const directoryExists = host.directoryExists?.bind(host);
  host.readFile = file => sources.get(file) ?? readFile(file);
  host.fileExists = file => sources.has(file) || fileExists(file);
  host.directoryExists = directory => directories.has(directory) || !!directoryExists?.(directory);
  host.getSourceFile = (file, languageVersion) => {
    const source = host.readFile(file);
    return source === undefined
      ? undefined
      : ts.createSourceFile(file, source, languageVersion, true);
  };
  host.resolveModuleNames = (names, containingFile) =>
    names.map(name => {
      if (name.endsWith(".svelte")) {
        const target = name.startsWith("$lib/")
          ? resolve(root, "src/lib", name.slice(5))
          : resolve(dirname(containingFile), name);
        if (sources.has(virtualName(target)))
          return { resolvedFileName: virtualName(target), extension: ts.Extension.Ts };
      }
      return ts.resolveModuleName(name, containingFile, options, host).resolvedModule;
    });
  const program = ts.createProgram([...sources.keys()], options, host);
  const checker = program.getTypeChecker();
  const projectFiles = program.getSourceFiles().filter(source => originals.has(source.fileName));
  const pathOf = (node: ts.Node): string =>
    originals.get(node.getSourceFile().fileName) ?? relative(root, node.getSourceFile().fileName);
  const project = (node: ts.Node): boolean => originals.has(node.getSourceFile().fileName);
  const location = (node: ts.Node): string =>
    `${pathOf(node)}:${node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
  const report = (
    node: ts.Node,
    rule: ArchitectureRule,
    message: string,
    trail: readonly ts.Node[] = [],
  ): void => {
    const position = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
    violations.push({
      file: pathOf(node),
      line: position.line + 1,
      column: position.character + 1,
      rule,
      message,
      provenance: [...new Set(trail.map(location))],
    });
  };
  const resolveSymbol = (symbol: ts.Symbol): ts.Symbol =>
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const declarations = (node: ts.Node): readonly ts.Declaration[] => {
    const symbol = checker.getSymbolAtLocation(
      ts.isPropertyAccessExpression(node) ? node.name : node,
    );
    return symbol ? (resolveSymbol(symbol).declarations ?? []) : [];
  };
  for (const source of projectFiles) {
    for (const diagnostic of program.getSyntacticDiagnostics(source)) {
      report(
        source,
        "unresolved-source",
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      );
    }
    walk(source, node => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const name = node.moduleSpecifier.text;
        if (
          (name.startsWith(".") || name.startsWith("$lib/")) &&
          !checker.getSymbolAtLocation(node.moduleSpecifier)
        )
          report(node, "unresolved-source", `Cannot resolve local module ${name}.`);
      }
    });
  }

  // Connect explicit constructor/function injection to its producer. This also follows
  // function ports whose annotation intentionally hides the supplying service method.
  const injected = new Map<ts.Symbol, ts.Expression[]>();
  const bind = (target: ts.Node, value: ts.Expression): void => {
    const symbol = checker.getSymbolAtLocation(target);
    if (symbol) injected.set(symbol, [...(injected.get(symbol) ?? []), value]);
  };
  const bindProperties = (
    target: ts.Type,
    value: ts.Expression,
    seen = new Set<ts.Node>(),
  ): void => {
    if (seen.has(value)) return;
    seen.add(value);
    if (!ts.isObjectLiteralExpression(value)) {
      // A model-owned port cannot erase a statically supplied controller implementation.
      // Bind declared members as well as object literals; do not infer from local names.
      const supplied = checker.getTypeAtLocation(value);
      for (const property of target.getProperties()) {
        const implementation = supplied.getProperty(property.name);
        if (!implementation || implementation === property) continue;
        for (const member of implementation.declarations ?? []) {
          if (
            (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) &&
            ts.isIdentifier(member.name)
          ) {
            injected.set(property, [...(injected.get(property) ?? []), member.name]);
          }
        }
      }
      for (const declaration of declarations(value))
        if (ts.isVariableDeclaration(declaration) && declaration.initializer)
          bindProperties(target, declaration.initializer, seen);
      return;
    }
    for (const property of value.properties) {
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property))
        continue;
      const symbol = target.getProperty(property.name.getText());
      if (symbol) {
        const expression = ts.isPropertyAssignment(property) ? property.initializer : property.name;
        injected.set(symbol, [...(injected.get(symbol) ?? []), expression]);
        bindProperties(checker.getTypeOfSymbolAtLocation(symbol, property), expression, seen);
      }
    }
  };
  // Test fixtures stand in for production wiring; what they inject is not an application
  // dependency, so a fake bound to a port does not make the port's callers depend on it.
  const testCode = (source: ts.SourceFile): boolean => isTestCode(pathOf(source));
  for (const source of projectFiles.filter(file => !testCode(file)))
    walk(source, node => {
      if (!ts.isNewExpression(node) && !ts.isCallExpression(node)) return;
      const signature = checker.getResolvedSignature(node);
      const declaration = signature?.declaration;
      if (!declaration || !project(declaration)) return;
      declaration.parameters.forEach((parameter, index) => {
        const argument = node.arguments?.[index];
        if (!argument) return;
        bind(parameter.name, argument);
        bindProperties(checker.getTypeAtLocation(parameter), argument);
      });
    });
  type Origin = { declaration: ts.Node; trail: readonly ts.Node[]; injected: boolean };
  const origins = (
    node: ts.Node,
    seen = new Set<ts.Node>(),
    trail: readonly ts.Node[] = [],
    throughInjection = false,
  ): Origin[] => {
    if (seen.has(node)) return [];
    seen.add(node);
    const next = [...trail, node];
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isNonNullExpression(node)
    )
      return origins(node.expression, seen, next, throughInjection);
    if (ts.isConditionalExpression(node))
      return [
        ...origins(node.whenTrue, seen, next, throughInjection),
        ...origins(node.whenFalse, seen, next, throughInjection),
      ];
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "bind"
    )
      return origins(node.expression.expression, seen, next, throughInjection);
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
      return [{ declaration: node, trail: next, injected: throughInjection }];
    const result: Origin[] = [];
    const symbol = checker.getSymbolAtLocation(
      ts.isPropertyAccessExpression(node) ? node.name : node,
    );
    if (symbol)
      for (const value of injected.get(resolveSymbol(symbol)) ?? [])
        result.push(...origins(value, seen, next, true));
    for (const declaration of declarations(node)) {
      if (!project(declaration)) {
        result.push({ declaration, trail: [...next, declaration], injected: throughInjection });
        continue;
      }
      if (
        (ts.isVariableDeclaration(declaration) ||
          ts.isPropertyAssignment(declaration) ||
          ts.isPropertyDeclaration(declaration) ||
          ts.isParameter(declaration)) &&
        declaration.initializer
      ) {
        result.push(
          ...origins(declaration.initializer, seen, [...next, declaration], throughInjection),
        );
      } else if (ts.isShorthandPropertyAssignment(declaration)) {
        const value = checker.getShorthandAssignmentValueSymbol(declaration);
        for (const target of value?.declarations ?? []) {
          if (ts.isVariableDeclaration(target) && target.initializer)
            result.push(...origins(target.initializer, seen, next, throughInjection));
        }
      } else if (ts.isExportAssignment(declaration))
        result.push(...origins(declaration.expression, seen, next, throughInjection));
      else result.push({ declaration, trail: [...next, declaration], injected: throughInjection });
    }
    return result;
  };
  const forbidden = (owner: SemanticLayer, target: SemanticLayer): boolean => {
    if (owner === "controllers") return ["controllers", "repositories"].includes(target);
    if (owner === "components") return ["services", "repositories", "remote"].includes(target);
    if (owner === "services")
      return ["services", "controllers", "remote", "factories"].includes(target);
    if (owner === "stores")
      return ["services", "controllers", "remote", "repositories"].includes(target);
    if (owner === "factories")
      return ["services", "controllers", "remote", "repositories"].includes(target);
    if (owner === "entry" || owner === "remote")
      return ["services", "repositories", "stores"].includes(target);
    if (owner === "tool-factory")
      return ["services", "repositories", "stores", "remote"].includes(target);
    return false;
  };
  const callRule = (owner: SemanticLayer): ArchitectureRule =>
    owner === "controllers"
      ? "controller-orchestration"
      : owner === "stores"
        ? "store-workflow"
        : owner === "factories"
          ? "factory-workflow"
          : owner === "tool-factory"
            ? "tool-operation"
            : "indirect-dependency";
  const inspectDependency = (
    site: ts.Node,
    expression: ts.Node,
    owner: SemanticLayer,
    seen = new Set<ts.Node>(),
    trail: readonly ts.Node[] = [],
  ): void => {
    if (
      ![
        "components",
        "services",
        "stores",
        "factories",
        "tool-factory",
        "controllers",
        "entry",
        "remote",
      ].includes(owner)
    )
      return;
    for (const origin of origins(expression)) {
      const target = origin.declaration;
      if (seen.has(target)) continue;
      seen.add(target);
      if (
        ["stores", "factories"].includes(owner) &&
        ts.isFunctionDeclaration(target) &&
        target.name?.text === "fetch" &&
        !project(target)
      ) {
        report(
          site,
          callRule(owner),
          `${owner} must not initiate network transport.`,
          origin.trail,
        );
        continue;
      }
      const targetLayer = layer(pathOf(target));
      const sameFile = pathOf(target) === pathOf(site);
      const sameClass = ancestorClass(target) && ancestorClass(target) === ancestorClass(site);
      const anotherCapability =
        (ancestorClass(target) && exportedClasses.has(ancestorClass(target)!)) ||
        serviceContracts.has(target.parent);
      const trace = [...trail, ...origin.trail];
      // A browser service owns its server interactions and calls the remote function (ADR 0041).
      const browserServiceCall =
        owner === "services" && targetLayer === "remote" && isBrowserService(pathOf(site));
      if (
        forbidden(owner, targetLayer) &&
        !browserServiceCall &&
        !(owner === "services" && targetLayer === "factories" && origin.injected) &&
        !sameClass &&
        (!sameFile || anotherCapability)
      ) {
        report(
          site,
          owner === "controllers" && targetLayer === "repositories"
            ? "controller-repository"
            : callRule(owner),
          owner === "controllers" && targetLayer === "repositories"
            ? "Controllers reach persistence through services, never through a repository."
            : owner === "controllers"
              ? "Controllers must coordinate services, not invoke another controller operation."
              : owner === "entry" || owner === "remote" || owner === "tool-factory"
                ? `${owner} must call controller operations, not ${targetLayer} behavior.`
                : `${owner} must not invoke or expose ${targetLayer} behavior. Move the operation to a controller.`,
          trace,
        );
        continue;
      }
      // A controller is the intended component boundary. Do not traverse its implementation.
      if (
        ["components", "entry", "remote", "tool-factory"].includes(owner) &&
        ["controllers", "factories"].includes(targetLayer)
      )
        continue;
      if (owner === "factories" && targetLayer === "factories" && !sameFile) continue;
      // A service is the controller's boundary to persistence; what it calls is its own concern.
      if (owner === "controllers" && targetLayer === "services") continue;
      if (project(target) && executable(target) && target.body && !sameClass)
        walkExecuted(target.body, child => {
          if (ts.isCallExpression(child))
            inspectDependency(site, child.expression, owner, seen, trace);
        });
    }
  };

  const classOrigins = (type: ts.Type, seen = new Set<ts.Type>()): ts.ClassLikeDeclaration[] => {
    if (seen.has(type)) return [];
    seen.add(type);
    const result = (type.symbol?.declarations ?? [])
      .filter(ts.isClassLike)
      .filter(
        node =>
          project(node) &&
          ["services", "controllers", "repositories", "stores"].includes(layer(pathOf(node))),
      );
    for (const argument of type.aliasTypeArguments ?? [])
      result.push(...classOrigins(argument, seen));
    for (const declaration of type.aliasSymbol?.declarations ?? []) {
      if (ts.isTypeAliasDeclaration(declaration) && project(declaration))
        walk(declaration.type, node => {
          if (ts.isTypeReferenceNode(node) || ts.isTypeQueryNode(node))
            result.push(...classOrigins(checker.getTypeAtLocation(node), seen));
        });
    }
    if (
      type.flags & ts.TypeFlags.Object &&
      (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
    )
      for (const argument of checker.getTypeArguments(type as ts.TypeReference))
        result.push(...classOrigins(argument, seen));
    if (
      type.flags & ts.TypeFlags.Object &&
      (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Interface
    )
      for (const base of checker.getBaseTypes(type as ts.InterfaceType))
        result.push(...classOrigins(base, seen));
    if (type.isUnionOrIntersection())
      for (const part of type.types) result.push(...classOrigins(part, seen));
    return result;
  };
  const inspectType = (
    site: ts.Node,
    type: ts.Type,
    nested: boolean,
    seen = new Set<ts.Type>(),
  ): void => {
    if (seen.has(type)) return;
    seen.add(type);
    for (const concrete of classOrigins(type))
      report(
        site,
        "concrete-dependency",
        "Expose a declared capability interface instead of a concrete implementation.",
        [concrete],
      );
    if (!nested || classOrigins(type).length) return;
    for (const property of type.getProperties()) {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      if (!declaration || !project(declaration) || hidden(declaration)) continue;
      inspectType(site, checker.getTypeOfSymbolAtLocation(property, declaration), true, seen);
    }
    for (const signature of type.getCallSignatures())
      inspectType(site, signature.getReturnType(), true, seen);
    if (type.isUnionOrIntersection())
      for (const part of type.types) inspectType(site, part, true, seen);
    for (const argument of type.aliasTypeArguments ?? []) inspectType(site, argument, true, seen);
  };
  const inputTypes = new Set<ts.Symbol>();
  const inputTypeVisits = new Set<ts.Type>();
  const markInput = (type: ts.Type): void => {
    if (inputTypeVisits.has(type)) return;
    inputTypeVisits.add(type);
    if (type.symbol) inputTypes.add(type.symbol);
    if (type.isUnionOrIntersection()) for (const part of type.types) markInput(part);
    for (const property of type.getProperties()) {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      if (declaration && project(declaration))
        markInput(checker.getTypeOfSymbolAtLocation(property, declaration));
    }
  };
  const controllerContracts = new Set<ts.Symbol>();
  for (const source of projectFiles)
    walk(source, node => {
      if (ts.isParameter(node)) markInput(checker.getTypeAtLocation(node));
      if (ts.isClassLike(node) && layer(pathOf(node)) === "controllers")
        for (const clause of node.heritageClauses ?? []) {
          if (clause.token === ts.SyntaxKind.ImplementsKeyword)
            for (const type of clause.types) {
              const symbol = checker.getTypeAtLocation(type).symbol;
              if (symbol) controllerContracts.add(symbol);
            }
        }
    });
  const exportedBehavior = (type: ts.Type, seen = new Set<ts.Type>()): boolean => {
    if (seen.has(type)) return false;
    seen.add(type);
    if (type.getCallSignatures().length) return true;
    return type.getProperties().some(property => {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      return (
        declaration &&
        project(declaration) &&
        exportedBehavior(checker.getTypeOfSymbolAtLocation(property, declaration), seen)
      );
    });
  };
  const exportedClasses = new Set<ts.ClassLikeDeclaration>();
  const serviceContracts = new Set<ts.Node>();
  for (const source of projectFiles) {
    const owner = layer(pathOf(source));
    const module = checker.getSymbolAtLocation(source);
    for (const exported of module ? checker.getExportsOfModule(module) : []) {
      const symbol = resolveSymbol(exported);
      const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
      if (!declaration || !project(declaration)) continue;
      if (owner === "services") {
        const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
        const classes = [
          ...(symbol.declarations ?? []).filter(ts.isClassLike),
          ...type
            .getConstructSignatures()
            .flatMap(signature =>
              (signature.getReturnType().symbol?.declarations ?? []).filter(ts.isClassLike),
            ),
        ];
        for (const concrete of classes) exportedClasses.add(concrete);

        if (!classes.length && exportedBehavior(type) && !(symbol.flags & ts.SymbolFlags.Type))
          report(
            declaration,
            "public-service-helper",
            "Public service behavior belongs on a class capability interface; keep helpers private.",
            [source],
          );
      }
      if (owner === "factories") {
        const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
        if (!type.getCallSignatures().length && !type.getConstructSignatures().length)
          inspectType(declaration, type, true);
        // Factory functions and static factory methods may return bundles of interfaces.
        for (const signature of type.getCallSignatures())
          inspectType(declaration, signature.getReturnType(), true);
        for (const property of type.getProperties()) {
          const member = property.valueDeclaration;
          if (member && project(member))
            for (const signature of checker
              .getTypeOfSymbolAtLocation(property, member)
              .getCallSignatures())
              inspectType(member, signature.getReturnType(), true);
        }
      }
    }
  }
  for (const concrete of exportedClasses) {
    const contracts =
      concrete.heritageClauses
        ?.filter(clause => clause.token === ts.SyntaxKind.ImplementsKeyword)
        .flatMap(clause => clause.types) ?? [];
    const valid = contracts.filter(contract =>
      declarations(contract.expression).some(ts.isInterfaceDeclaration),
    );
    if (!valid.length || valid.length !== contracts.length)
      report(
        concrete,
        "service-interface",
        "Public service classes must explicitly implement capability interfaces.",
      );
    for (const contract of valid)
      for (const declaration of declarations(contract.expression))
        serviceContracts.add(declaration);
    const members = new Set(
      valid.flatMap(contract =>
        checker
          .getTypeAtLocation(contract)
          .getProperties()
          .map(property => property.name),
      ),
    );
    const instance = checker.getTypeAtLocation(concrete);
    for (const property of instance.getProperties()) {
      const member = property.valueDeclaration ?? property.declarations?.[0];
      if (!member || hidden(member)) continue;
      if (!members.has(property.name))
        report(
          member,
          "public-service-helper",
          "Public service members must belong to the implemented capability contract.",
          [concrete],
        );
    }
  }

  const hasCallable = (type: ts.Type, seen = new Set<ts.Type>()): boolean => {
    if (seen.has(type) || !(type.flags & ts.TypeFlags.Object)) return false;
    seen.add(type);
    if (type.getCallSignatures().length) return true;
    return type.getProperties().some(property => {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      return (
        declaration && hasCallable(checker.getTypeOfSymbolAtLocation(property, declaration), seen)
      );
    });
  };
  const inspectResult = (site: ts.Node, type: ts.Type, seen = new Set<ts.Type>()): void => {
    if (seen.has(type)) return;
    seen.add(type);
    for (const declaration of type.symbol?.declarations ?? []) {
      const owner = layer(pathOf(declaration));
      const stateView =
        owner === "stores" &&
        type.getProperties().every(property => {
          const member = property.valueDeclaration ?? property.declarations?.[0];
          return (
            member &&
            (modifier(member, ts.SyntaxKind.ReadonlyKeyword) ||
              ts.isGetAccessorDeclaration(member)) &&
            !checker.getTypeOfSymbolAtLocation(property, member).getCallSignatures().length
          );
        });
      if (
        project(declaration) &&
        ["services", "repositories", "stores", "remote"].includes(owner) &&
        !stateView &&
        (owner === "stores" || hasCallable(type))
      )
        report(
          site,
          "controller-collaborator",
          "Controller operations return results or readonly state, not collaborators.",
          [declaration],
        );
    }
    if (type.isUnionOrIntersection())
      for (const part of type.types) inspectResult(site, part, seen);
    if (
      type.flags & ts.TypeFlags.Object &&
      (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
    )
      for (const argument of checker.getTypeArguments(type as ts.TypeReference))
        inspectResult(site, argument, seen);
    for (const property of type.getProperties()) {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      if (declaration && project(declaration) && !hidden(declaration))
        inspectResult(site, checker.getTypeOfSymbolAtLocation(property, declaration), seen);
    }
  };
  const mutableCollection = (type: ts.Type): boolean =>
    (type.isUnionOrIntersection() && type.types.some(mutableCollection)) ||
    ["Map", "Set", "WeakMap", "WeakSet", "Array", "Date", "Promise", "AbortController"].includes(
      type.symbol?.name ?? "",
    );
  const immutable = (type: ts.Type, seen = new Set<ts.Type>()): boolean => {
    if (seen.has(type)) return true;
    seen.add(type);
    if (
      type.flags &
      (ts.TypeFlags.StringLike |
        ts.TypeFlags.NumberLike |
        ts.TypeFlags.BooleanLike |
        ts.TypeFlags.BigIntLike |
        ts.TypeFlags.Null |
        ts.TypeFlags.Undefined |
        ts.TypeFlags.EnumLike)
    )
      return true;
    if (type.isUnionOrIntersection()) return type.types.every(part => immutable(part, seen));
    if (mutableCollection(type)) return false;
    if (type.symbol?.name === "ReadonlyArray") {
      const element = type.getNumberIndexType();
      return !!element && immutable(element, seen);
    }
    const constContext = (node: ts.Node): boolean => {
      for (
        let current: ts.Node | undefined = node;
        current && !ts.isStatement(current);
        current = current.parent
      ) {
        if (ts.isAsExpression(current) && current.type.getText() === "const") return true;
      }
      return false;
    };
    const properties = type.getProperties();
    return (
      properties.length > 0 &&
      properties.every(property => {
        const declaration = property.valueDeclaration ?? property.declarations?.[0];
        return (
          declaration &&
          (modifier(declaration, ts.SyntaxKind.ReadonlyKeyword) ||
            constContext(declaration) ||
            type.aliasSymbol?.name === "Readonly") &&
          immutable(checker.getTypeOfSymbolAtLocation(property, declaration), seen)
        );
      })
    );
  };
  const roots = (node: ts.Node, seen = new Set<ts.Node>()): ts.Declaration[] => {
    if (seen.has(node)) return [];
    seen.add(node);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ThisKeyword) return [...declarations(node)];
      return roots(node.expression, seen);
    }
    return declarations(node).flatMap(declaration => {
      if (
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        (ts.isIdentifier(declaration.initializer) ||
          ts.isPropertyAccessExpression(declaration.initializer) ||
          ts.isElementAccessExpression(declaration.initializer))
      )
        return roots(declaration.initializer, seen);
      return [declaration];
    });
  };
  const mutations = new Map<ts.Declaration, ts.Node[]>();
  const mutators = new Set([
    "set",
    "add",
    "delete",
    "clear",
    "push",
    "pop",
    "shift",
    "unshift",
    "splice",
    "sort",
    "reverse",
    "fill",
    "copyWithin",
    "setTime",
    "setDate",
    "setFullYear",
    "setHours",
    "setMinutes",
    "setSeconds",
    "setMilliseconds",
  ]);
  for (const source of projectFiles)
    walk(source, node => {
      let target: ts.Node | undefined;
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      )
        target = node.left;
      if (
        (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)
      )
        target = node.operand;
      if (ts.isDeleteExpression(node)) target = node.expression;
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        mutators.has(node.expression.name.text) &&
        mutableCollection(checker.getTypeAtLocation(node.expression.expression))
      )
        target = node.expression.expression;
      if (target)
        for (const declaration of roots(target))
          mutations.set(declaration, [...(mutations.get(declaration) ?? []), node]);
    });
  const staticData = (node: ts.Expression, seen = new Set<ts.Node>()): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    if (
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isParenthesizedExpression(node)
    )
      return staticData(node.expression, seen);
    if (
      ts.isLiteralExpression(node) ||
      [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(
        node.kind,
      )
    )
      return true;
    if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node))
      return (
        immutable(checker.getTypeAtLocation(node)) ||
        declarations(node).some(
          declaration =>
            ts.isVariableDeclaration(declaration) &&
            !!declaration.initializer &&
            !mutations.has(declaration) &&
            staticData(declaration.initializer, seen),
        )
      );
    if (ts.isArrayLiteralExpression(node))
      return node.elements.every(item => staticData(item, new Set(seen)));
    if (ts.isObjectLiteralExpression(node))
      return node.properties.every(
        property =>
          ts.isPropertyAssignment(property) && staticData(property.initializer, new Set(seen)),
      );
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["Map", "Set"].includes(node.expression.text)
    )
      return node.arguments?.length === 1 && staticData(node.arguments[0], seen);
    return false;
  };
  const staticConfiguration = (node: ts.VariableDeclaration | ts.PropertyDeclaration): boolean =>
    !!node.initializer && staticData(node.initializer) && !mutations.has(node);
  const statelessFunction = (node: ts.Node): boolean => {
    if (!executable(node)) return false;
    for (const [declaration, writes] of mutations) {
      if (
        declaration.getSourceFile() !== node.getSourceFile() ||
        declaration.getStart() < node.getStart() ||
        declaration.end > node.end
      ) {
        if (
          writes.some(
            write =>
              write.getSourceFile() === node.getSourceFile() &&
              write.getStart() >= node.getStart() &&
              write.end <= node.end,
          )
        )
          return false;
      }
    }
    return true;
  };
  const statelessValue = (node: ts.Expression): boolean => {
    if (statelessFunction(node)) return true;
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "bind" &&
      node.arguments.every(argument => argument.kind === ts.SyntaxKind.ThisKeyword)
    )
      return origins(node.expression.expression).every(
        origin => executable(origin.declaration) && statelessFunction(origin.declaration),
      );
    if (ts.isObjectLiteralExpression(node))
      return node.properties.every(
        property =>
          (ts.isPropertyAssignment(property) && statelessValue(property.initializer)) ||
          (ts.isMethodDeclaration(property) && statelessFunction(property)),
      );
    return false;
  };
  const capturesState = (expression: ts.Expression): boolean => {
    if (!ts.isCallExpression(expression)) return false;
    let captured = false;
    walk(expression, node => {
      if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        if (!statelessFunction(node)) captured = true;
      }
    });
    return captured;
  };
  const inConstructor = (node: ts.Node): boolean => {
    for (let current = node.parent; current && !ts.isClassLike(current); current = current.parent)
      if (ts.isConstructorDeclaration(current)) return true;
    return false;
  };
  const injectedReference = (member: ts.PropertyDeclaration | ts.ParameterDeclaration): boolean => {
    if (ts.isParameter(member)) return true;
    if (
      staticConfiguration(member) ||
      (member.initializer && statelessValue(member.initializer) && !mutations.has(member))
    )
      return true;
    if (!member.initializer) return true; // Constructor assignment is checked separately below.
    return declarations(member.initializer).some(ts.isParameter);
  };
  const constructorCollaborator = (expression: ts.Expression): boolean => {
    if (statelessFunction(expression)) return true;
    if (ts.isIdentifier(expression))
      return declarations(expression).some(
        item =>
          ts.isParameter(item) ||
          (ts.isVariableDeclaration(item) && ts.isVariableStatement(item.parent.parent)),
      );
    if (ts.isPropertyAccessExpression(expression))
      return constructorCollaborator(expression.expression);
    if (
      ts.isBinaryExpression(expression) &&
      [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(
        expression.operatorToken.kind,
      )
    )
      return constructorCollaborator(expression.left) && constructorCollaborator(expression.right);
    // Opaque provider construction is a composition concern, not proof of cross-call state.
    if (ts.isCallExpression(expression) || ts.isNewExpression(expression)) {
      const type = checker.getTypeAtLocation(expression);
      return !mutableCollection(type) && !type.getCallSignatures().length && hasCallable(type);
    }
    return false;
  };
  for (const source of projectFiles) {
    const owner = layer(pathOf(source));
    walk(source, node => {
      if (ts.isCallExpression(node)) {
        inspectDependency(node, node.expression, owner);
      }
      if (ts.isNamespaceImport(node) && ["services", "components"].includes(owner)) {
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol)
          for (const exported of checker.getExportsOfModule(resolveSymbol(symbol))) {
            for (const declaration of resolveSymbol(exported).declarations ?? [])
              if (
                "name" in declaration &&
                declaration.name &&
                ts.isIdentifier(declaration.name as ts.Node)
              )
                inspectDependency(node, declaration.name as ts.Node, owner);
          }
      }
      if (ts.isImportSpecifier(node) || (ts.isImportClause(node) && node.name)) {
        const name = node.name;
        if (name && ["services", "components"].includes(owner))
          inspectDependency(node, name, owner);
      }
      if (
        (ts.isTypeReferenceNode(node) || ts.isTypeQueryNode(node)) &&
        ["services", "controllers", "stores", "components"].includes(owner)
      ) {
        const type = checker.getTypeAtLocation(node);
        if (
          owner === "components" ||
          !classOrigins(type).every(
            item => layer(pathOf(item)) === "stores" || item === ancestorClass(node),
          )
        )
          inspectType(node, type, false);
      }
      if (
        ["services", "controllers", "stores"].includes(owner) &&
        (ts.isParameter(node) || ts.isPropertyDeclaration(node)) &&
        !node.type &&
        node.initializer
      ) {
        const type = checker.getTypeAtLocation(node);
        if (
          classOrigins(type).some(
            item => layer(pathOf(item)) !== "stores" && item !== ancestorClass(node),
          )
        )
          inspectType(node, type, false);
      }
      if (
        owner === "controllers" &&
        (ts.isMethodSignature(node) ||
          ((ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)) && !hidden(node)))
      ) {
        const signature = checker.getSignatureFromDeclaration(node);
        if (signature) {
          const result = signature.getReturnType();
          inspectType(node, result, true);
          inspectResult(node, result);
        }
      }
      if (
        owner === "controllers" &&
        !hidden(node) &&
        (ts.isPropertyDeclaration(node) ||
          (ts.isPropertySignature(node) &&
            ts.isInterfaceDeclaration(node.parent) &&
            (() => {
              const symbol = checker.getTypeAtLocation(node.parent).symbol;
              return !!symbol && (controllerContracts.has(symbol) || !inputTypes.has(symbol));
            })()))
      ) {
        const type = checker.getTypeAtLocation(node);
        inspectType(node, type, true);
        inspectResult(node, type);
      }
      if (owner !== "services") return;
      if (
        (ts.isPropertyDeclaration(node) ||
          (ts.isParameter(node) &&
            ts.isConstructorDeclaration(node.parent) &&
            ts.isParameterPropertyDeclaration(node, node.parent))) &&
        exportedClasses.has(ancestorClass(node)!)
      ) {
        const type = checker.getTypeAtLocation(node);
        if (
          !modifier(node, ts.SyntaxKind.ReadonlyKeyword) ||
          (mutations.get(node) ?? []).some(write => !inConstructor(write)) ||
          (mutableCollection(type) &&
            !(ts.isPropertyDeclaration(node) && staticConfiguration(node))) ||
          (!injectedReference(node) && !immutable(type))
        )
          report(
            node,
            "retained-service-state",
            "Move retained mutable service state to an explicitly scoped store.",
          );
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isVariableDeclarationList(node.parent) &&
        ts.isVariableStatement(node.parent.parent) &&
        ts.isSourceFile(node.parent.parent.parent)
      ) {
        const type = checker.getTypeAtLocation(node);
        if (
          !(node.parent.flags & ts.NodeFlags.Const) ||
          mutations.has(node) ||
          (node.initializer &&
            (capturesState(node.initializer) ||
              (mutableCollection(type) && !staticConfiguration(node))))
        )
          report(
            node,
            "retained-service-state",
            "Module state survives service operations; give it an explicit store owner.",
          );
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
        ts.isPropertyAccessExpression(node.left) &&
        node.left.expression.kind === ts.SyntaxKind.ThisKeyword
      ) {
        const concrete = ancestorClass(node);
        if (!concrete || !exportedClasses.has(concrete)) return;
        let constructor = false;
        for (let parent = node.parent; parent !== concrete; parent = parent.parent)
          if (ts.isConstructorDeclaration(parent)) constructor = true;
        const member = declarations(node.left)[0];
        if (
          !constructor ||
          (!constructorCollaborator(node.right) &&
            !immutable(checker.getTypeAtLocation(node.right)))
        )
          report(
            node,
            "retained-service-state",
            "An operation must not retain mutable values on its service instance.",
            member ? [member] : [],
          );
      }
    });
  }
  const unique = new Map(
    violations.map(item => [
      `${item.file}:${item.line}:${item.column}:${item.rule}:${item.provenance.at(-1) ?? ""}`,
      item,
    ]),
  );
  return [...unique.values()].sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.column - b.column ||
      a.rule.localeCompare(b.rule),
  );
}
