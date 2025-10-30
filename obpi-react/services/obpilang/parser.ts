import { Token, TokenType } from './lexer';
import {
  Program, Statement, Expression,
  VariableDeclaration, FunctionDeclaration, IfStatement, WhileStatement, BlockStatement, ReturnStatement, ImportStatement,
  BinaryExpression, Identifier, NumericLiteral, StringLiteral, CallExpression, BooleanLiteral, NullLiteral
} from './ast';

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): Program {
    const program: Program = { type: "Program", body: [] };
    while (!this.isAtEnd()) {
      program.body.push(this.parseStatement());
    }
    return program;
  }
  
  private isAtEnd(): boolean {
      return this.tokens[this.current].type === TokenType.EOF;
  }

  private peek(): Token {
      return this.tokens[this.current];
  }

  private advance(): Token {
      if(!this.isAtEnd()) this.current++;
      return this.tokens[this.current - 1];
  }

  private expect(type: TokenType, message: string): Token {
      if (this.peek().type === type) {
          return this.advance();
      }
      throw new Error(`Parser Error: ${message}. Found ${this.peek().type} instead of ${type}.`);
  }

  // --- STATEMENT PARSERS ---

  private parseStatement(): Statement {
      switch (this.peek().type) {
          case TokenType.Let:
              return this.parseVariableDeclaration();
          case TokenType.Func:
              return this.parseFunctionDeclaration();
          case TokenType.If:
              return this.parseIfStatement();
          case TokenType.While:
              return this.parseWhileStatement();
          case TokenType.Return:
              return this.parseReturnStatement();
          case TokenType.Import:
              return this.parseImportStatement();
          case TokenType.OpenBrace:
              return this.parseBlockStatement();
          default:
              return this.parseExpressionStatement();
      }
  }

  private parseImportStatement(): ImportStatement {
      this.advance(); // consume 'import'
      const path = this.expect(TokenType.String, "Expected import path string.");
      this.expect(TokenType.Semicolon, "Expected ';' after import statement.");
      return { type: "ImportStatement", path: { type: "StringLiteral", value: path.value } };
  }

  private parseReturnStatement(): ReturnStatement {
      this.advance(); // consume 'return'
      let argument = null;
      if (this.peek().type !== TokenType.Semicolon) {
          argument = this.parseExpression();
      }
      this.expect(TokenType.Semicolon, "Expected ';' after return value.");
      return { type: "ReturnStatement", argument };
  }

  private parseVariableDeclaration(): VariableDeclaration {
      this.advance(); // consume 'let'
      const identifier = this.expect(TokenType.Identifier, "Expected variable name.");
      this.expect(TokenType.Equals, "Expected '=' after variable name.");
      const value = this.parseExpression();
      this.expect(TokenType.Semicolon, "Expected ';' after variable declaration.");
      return {
          type: "VariableDeclaration",
          identifier: { type: "Identifier", name: identifier.value },
          value,
      };
  }
  
  private parseFunctionDeclaration(): FunctionDeclaration {
      this.advance(); // consume 'func'
      const name = this.expect(TokenType.Identifier, "Expected function name.");
      this.expect(TokenType.OpenParen, "Expected '(' after function name.");
      const params: Identifier[] = [];
      if(this.peek().type !== TokenType.CloseParen) {
          do {
              if (this.peek().type === TokenType.Comma) this.advance(); // consume comma
              const param = this.expect(TokenType.Identifier, "Expected parameter name.");
              params.push({type: "Identifier", name: param.value});
          } while(this.peek().type === TokenType.Comma);
      }
      this.expect(TokenType.CloseParen, "Expected ')' after parameters.");
      const body = this.parseBlockStatement();
      return { type: "FunctionDeclaration", name: { type: "Identifier", name: name.value }, params, body };
  }
  
  private parseIfStatement(): IfStatement {
      this.advance(); // consume 'if'
      this.expect(TokenType.OpenParen, "Expected '(' after 'if'.");
      const test = this.parseExpression();
      this.expect(TokenType.CloseParen, "Expected ')' after if condition.");
      const consequent = this.parseBlockStatement();
      let alternate;
      if (this.peek().type === TokenType.Else) {
          this.advance(); // consume 'else'
          alternate = this.parseBlockStatement();
      }
      return { type: "IfStatement", test, consequent, alternate };
  }

  private parseWhileStatement(): WhileStatement {
      this.advance(); // consume 'while'
      this.expect(TokenType.OpenParen, "Expected '(' after 'while'.");
      const test = this.parseExpression();
      this.expect(TokenType.CloseParen, "Expected ')' after while condition.");
      const body = this.parseBlockStatement();
      return { type: "WhileStatement", test, body };
  }

  private parseBlockStatement(): BlockStatement {
      this.expect(TokenType.OpenBrace, "Expected '{' to start a block.");
      const body: Statement[] = [];
      while (this.peek().type !== TokenType.CloseBrace && !this.isAtEnd()) {
          body.push(this.parseStatement());
      }
      this.expect(TokenType.CloseBrace, "Expected '}' to end a block.");
      return { type: "BlockStatement", body };
  }

  private parseExpressionStatement(): Statement {
      const expression = this.parseExpression();
      this.expect(TokenType.Semicolon, "Expected ';' after expression.");
      return { type: "ExpressionStatement", expression };
  }

  // --- EXPRESSION PARSERS (with precedence) ---

  private parseExpression(): Expression {
      return this.parseAssignmentExpression();
  }
  
  private parseAssignmentExpression(): Expression {
      const left = this.parseComparisonExpression();
      if(this.peek().type === TokenType.Equals) {
          this.advance(); // consume '='
          if (left.type !== "Identifier") {
              throw new Error("Parser Error: Invalid left-hand side in assignment expression.");
          }
          const value = this.parseAssignmentExpression();
          // This is a simplification. A proper implementation would have an AssignmentExpression node.
          // For now, we'll treat `let a = 5` and `a = 5` differently. `let` is required for declaration.
          // To implement `a = 5`, we'd need an AssignmentExpression type. For simplicity, we model it as a BinaryExpr for now.
          return { type: "BinaryExpression", left, operator: "=", right: value } as BinaryExpression;
      }
      return left;
  }
  
  private parseComparisonExpression(): Expression {
      let left = this.parseAdditiveExpression();
      while (this.peek().type === TokenType.ComparisonOperator) {
          const operator = this.advance().value;
          const right = this.parseAdditiveExpression();
          left = { type: "BinaryExpression", left, operator, right } as BinaryExpression;
      }
      return left;
  }

  private parseAdditiveExpression(): Expression {
    let left = this.parseMultiplicativeExpression();
    while (this.peek().value === '+' || this.peek().value === '-') {
      const operator = this.advance().value;
      const right = this.parseMultiplicativeExpression();
      left = { type: "BinaryExpression", left, operator, right } as BinaryExpression;
    }
    return left;
  }

  private parseMultiplicativeExpression(): Expression {
    let left = this.parseCallExpression();
    while (this.peek().value === '*' || this.peek().value === '/') {
      const operator = this.advance().value;
      const right = this.parseCallExpression();
      left = { type: "BinaryExpression", left, operator, right } as BinaryExpression;
    }
    return left;
  }

  private parseCallExpression(): Expression {
      let expr = this.parsePrimaryExpression();
      if (this.peek().type === TokenType.OpenParen) {
          if (expr.type !== "Identifier") throw new Error("Parser Error: Expected identifier before call expression.");
          expr = this.parseCallExpressionArgs(expr as Identifier);
      }
      return expr;
  }

  private parseCallExpressionArgs(callee: Identifier): CallExpression {
      this.advance(); // consume '('
      const args: Expression[] = [];
      if(this.peek().type !== TokenType.CloseParen) {
          do {
              if (this.peek().type === TokenType.Comma) this.advance();
              args.push(this.parseExpression());
          } while(this.peek().type === TokenType.Comma)
      }
      this.expect(TokenType.CloseParen, "Expected ')' after arguments.");
      return { type: "CallExpression", callee, args };
  }

  private parsePrimaryExpression(): Expression {
    switch (this.peek().type) {
      case TokenType.Identifier:
        return { type: "Identifier", name: this.advance().value } as Identifier;
      case TokenType.Number:
        return { type: "NumericLiteral", value: parseFloat(this.advance().value) } as NumericLiteral;
      case TokenType.String:
        return { type: "StringLiteral", value: this.advance().value } as StringLiteral;
      case TokenType.True:
        this.advance();
        return { type: "BooleanLiteral", value: true } as BooleanLiteral;
      case TokenType.False:
        this.advance();
        return { type: "BooleanLiteral", value: false } as BooleanLiteral;
      case TokenType.Null:
          this.advance();
          return { type: "NullLiteral", value: null } as NullLiteral;
      case TokenType.OpenParen:
        this.advance(); // consume '('
        const expr = this.parseExpression();
        this.expect(TokenType.CloseParen, "Expected ')' after expression.");
        return expr;
      default:
        throw new Error(`Parser Error: Unexpected token: ${JSON.stringify(this.peek())}`);
    }
  }
}