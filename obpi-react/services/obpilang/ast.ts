// All nodes in the AST must have a type property.
export interface ASTNode {
  type: string;
}

// A program is a sequence of statements.
export interface Program extends ASTNode {
  type: "Program";
  body: Statement[];
}

// Statements are instructions that perform actions.
export type Statement =
  | ExpressionStatement
  | VariableDeclaration
  | BlockStatement
  | IfStatement
  | WhileStatement
  | FunctionDeclaration
  | ReturnStatement
  | ImportStatement;

// Expressions are pieces of code that evaluate to a value.
export type Expression =
  | Identifier
  | Literal
  | BinaryExpression
  | CallExpression;

// --- STATEMENTS ---

export interface ExpressionStatement extends ASTNode {
  type: "ExpressionStatement";
  expression: Expression;
}

export interface VariableDeclaration extends ASTNode {
  type: "VariableDeclaration";
  identifier: Identifier;
  value: Expression;
}

export interface BlockStatement extends ASTNode {
  type: "BlockStatement";
  body: Statement[];
}

export interface IfStatement extends ASTNode {
  type: "IfStatement";
  test: Expression;
  consequent: BlockStatement;
  alternate?: BlockStatement;
}

export interface WhileStatement extends ASTNode {
  type: "WhileStatement";
  test: Expression;
  body: BlockStatement;
}

export interface FunctionDeclaration extends ASTNode {
    type: "FunctionDeclaration";
    name: Identifier;
    params: Identifier[];
    body: BlockStatement;
}

export interface ReturnStatement extends ASTNode {
    type: "ReturnStatement";
    argument: Expression | null;
}

export interface ImportStatement extends ASTNode {
    type: "ImportStatement";
    path: StringLiteral;
}

// --- EXPRESSIONS ---

export interface Identifier extends ASTNode {
  type: "Identifier";
  name: string;
}

export interface CallExpression extends ASTNode {
    type: "CallExpression";
    callee: Identifier;
    args: Expression[];
}

export interface BinaryExpression extends ASTNode {
  type: "BinaryExpression";
  left: Expression;
  operator: string;
  right: Expression;
}

// --- LITERALS ---

export type Literal = StringLiteral | NumericLiteral | BooleanLiteral | NullLiteral;

export interface StringLiteral extends ASTNode {
  type: "StringLiteral";
  value: string;
}

export interface NumericLiteral extends ASTNode {
  type: "NumericLiteral";
  value: number;
}

export interface BooleanLiteral extends ASTNode {
    type: "BooleanLiteral";
    value: boolean;
}

export interface NullLiteral extends ASTNode {
    type: "NullLiteral";
    value: null;
}