#!/usr/bin/env node
/**
 * Every NestJS HTTP handler must be explicitly classified:
 *   public | authenticated | platform | tenant | tenant + permissions
 * Classification is inferred from @Public(), @UseGuards, @RequirePermissions.
 * A new handler with no metadata fails this check.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function controllerFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return controllerFiles(target);
    return entry.isFile() && entry.name.endsWith('controller.ts') ? [target] : [];
  });
}

const files = controllerFiles(path.join(root, 'apps'));
const HTTP = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head']);

function decorators(node) {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

function decoratorCall(decorator) {
  return ts.isCallExpression(decorator.expression) ? decorator.expression : null;
}

function decoratorName(decorator, source) {
  return (
    decoratorCall(decorator)?.expression.getText(source) ?? decorator.expression.getText(source)
  );
}

function guardsFor(items, source) {
  const guards = new Set();
  for (const item of items) {
    const call = decoratorCall(item);
    if (call && call.expression.getText(source) === 'UseGuards') {
      for (const argument of call.arguments) guards.add(argument.getText(source));
    }
  }
  return guards;
}

const failures = [];
let handlers = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  for (const statement of source.statements) {
    if (!ts.isClassDeclaration(statement)) continue;
    const classDecorators = decorators(statement);
    const classNames = new Set(classDecorators.map((item) => decoratorName(item, source)));
    const classGuards = guardsFor(classDecorators, source);

    for (const member of statement.members) {
      if (!ts.isMethodDeclaration(member)) continue;
      const methodDecorators = decorators(member);
      const names = new Set(methodDecorators.map((item) => decoratorName(item, source)));
      if (![...names].some((name) => HTTP.has(name))) continue;

      handlers += 1;
      const guards = new Set([...classGuards, ...guardsFor(methodDecorators, source)]);
      const isPublic = classNames.has('Public') || names.has('Public');
      const requiresPermissions = names.has('RequirePermissions');
      const hasJwt = guards.has('JwtGuard');
      const hasPermissionChain =
        hasJwt && guards.has('TenantContextGuard') && guards.has('PermissionsGuard');
      const classified = isPublic || (requiresPermissions ? hasPermissionChain : hasJwt);

      if (!classified) {
        const position = source.getLineAndCharacterOfPosition(member.getStart(source));
        const name = member.name?.getText(source) ?? '<anonymous>';
        failures.push(`${path.relative(root, file)}:${position.line + 1}: unclassified ${name}()`);
      }
    }
  }
}

if (files.length === 0) {
  console.error('check:routes: no controller files found');
  process.exit(1);
}
if (handlers === 0) {
  console.error('check:routes: no HTTP handlers found');
  process.exit(1);
}
if (failures.length) {
  console.error(
    'check:routes failed — add @Public() or JWT guards; permission routes require ' +
      'JwtGuard, TenantContextGuard, and PermissionsGuard:\n' +
      failures.map((f) => `  ${f}`).join('\n'),
  );
  process.exit(1);
}
console.log(`check:routes ok (${handlers} handlers in ${files.length} controllers)`);
