import type { FileInfo } from "chisel/checker/models/file_info";
import type { ImportEdge } from "chisel/checker/models/import_edge";
import { scriptsOf } from "chisel/checker/repositories/file_parser";
import ts from "typescript";

/**
 * Decides whether a type-only import names **contracts** only.
 *
 * A contract is an interface, or a type alias that is data or that names
 * another contract. A class is never a contract, and neither is an alias of
 * one (`typeof Thing`, or an alias that resolves to a class): depending on it
 * couples the importer to an implementation.
 *
 * Browser coordinators receive controller operations from their factories by
 * interface. The interface is declared beside the controller that owns it, so
 * importing it crosses into the controllers layer without depending on any
 * controller implementation. Names are followed through re-exports and
 * imports, so moving a contract behind a barrel does not change the answer.
 */
export class ContractImports {
  private readonly targets = new Map<string, string>();

  constructor(
    private readonly files: ReadonlyMap<string, FileInfo>,
    edges: readonly ImportEdge[],
  ) {
    for (const edge of edges) this.targets.set(`${edge.importer}\0${edge.specifier}`, edge.imported);
  }

  /** True when every name this edge brings in is a contract. */
  importsOnlyContracts(edge: ImportEdge): boolean {
    const source = this.files.get(edge.importer);
    if (source?.ast === undefined) return false;
    let matched = false;
    for (const { sf } of scriptsOf(source.ast)) {
      for (const statement of sf.statements) {
        const names = this._namesFrom(statement, edge.specifier);
        if (names === undefined) continue;
        matched = true;
        if (names === null) return false;
        if (!names.every(name => this._isContract(edge.imported, name, new Set()))) return false;
      }
    }
    return matched;
  }

  /**
   * The imported names a statement takes from `specifier`. `undefined` when the
   * statement does not import it; `null` when it does so in a form that is not
   * a list of named types (a default or namespace import, or `export *`).
   */
  private _namesFrom(statement: ts.Statement, specifier: string): string[] | null | undefined {
    if (ts.isExportDeclaration(statement)) {
      if (!statement.isTypeOnly || !isSpecifier(statement.moduleSpecifier, specifier)) return undefined;
      const clause = statement.exportClause;
      if (clause === undefined || !ts.isNamedExports(clause)) return null;
      return clause.elements.map(entry => (entry.propertyName ?? entry.name).text);
    }
    if (!ts.isImportDeclaration(statement) || !isSpecifier(statement.moduleSpecifier, specifier)) {
      return undefined;
    }
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    if (clause?.name !== undefined || bindings === undefined || !ts.isNamedImports(bindings)) return null;
    if (bindings.elements.length === 0) return null;
    return bindings.elements.map(entry => (entry.propertyName ?? entry.name).text);
  }

  private _isContract(path: string, name: string, seen: ReadonlySet<string>): boolean {
    const key = `${path}:${name}`;
    if (seen.has(key)) return false;
    const visited = new Set([...seen, key]);
    const file = this.files.get(path);
    if (file?.ast === undefined) return false;

    for (const { sf } of scriptsOf(file.ast)) {
      for (const statement of sf.statements) {
        const declared = this._declared(statement, name, path, visited);
        if (declared !== undefined) return declared;
        const followed = this._followed(statement, name, path, visited);
        if (followed !== undefined) return followed;
      }
    }
    return false;
  }

  /** The answer when `statement` declares `name` in this file. */
  private _declared(
    statement: ts.Statement,
    name: string,
    path: string,
    visited: ReadonlySet<string>,
  ): boolean | undefined {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) return true;
    if (ts.isClassDeclaration(statement) && statement.name?.text === name) return false;
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== name) return undefined;
    const type = statement.type;
    // An alias of another name is whatever that name is: a class alias is not
    // a contract just because it is spelled `type`.
    if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
      return this._isContract(path, type.typeName.text, visited);
    }
    return !ts.isTypeQueryNode(type);
  }

  /** The answer when `statement` brings `name` in from another file. */
  private _followed(
    statement: ts.Statement,
    name: string,
    path: string,
    visited: ReadonlySet<string>,
  ): boolean | undefined {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings === undefined || !ts.isNamedImports(bindings)) return undefined;
      const entry = bindings.elements.find(element => element.name.text === name);
      if (entry === undefined) return undefined;
      const target = this._target(path, statement.moduleSpecifier.text);
      return target !== undefined
        && this._isContract(target, (entry.propertyName ?? entry.name).text, visited);
    }
    if (!ts.isExportDeclaration(statement)) return undefined;
    const target = statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)
      ? this._target(path, statement.moduleSpecifier.text)
      : path;
    if (target === undefined) return undefined;
    const clause = statement.exportClause;
    if (clause === undefined) {
      return this._isContract(target, name, visited) ? true : undefined;
    }
    if (!ts.isNamedExports(clause)) return undefined;
    const entry = clause.elements.find(element => element.name.text === name);
    if (entry === undefined) return undefined;
    return this._isContract(target, (entry.propertyName ?? entry.name).text, visited) ? true : undefined;
  }

  private _target(importer: string, specifier: string): string | undefined {
    return this.targets.get(`${importer}\0${specifier}`);
  }
}

function isSpecifier(node: ts.Expression | undefined, specifier: string): boolean {
  return node !== undefined && ts.isStringLiteral(node) && node.text === specifier;
}
