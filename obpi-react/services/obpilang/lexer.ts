export enum TokenType {
  // Literals
  Number,
  String,
  Identifier,

  // Keywords
  Let,
  Func,
  If,
  Else,
  While,
  Return,
  Import,
  True,
  False,
  Null,

  // Grouping & Operators
  OpenParen, CloseParen,   // ( )
  OpenBrace, CloseBrace,   // { }
  Equals,                 // =
  Semicolon,              // ;
  Comma,                  // ,
  BinaryOperator,         // + - * /
  ComparisonOperator,     // == != < > <= >=
  
  // End of File
  EOF,
}

export interface Token {
  type: TokenType;
  value: string;
}

const KEYWORDS: Record<string, TokenType> = {
  "let": TokenType.Let,
  "func": TokenType.Func,
  "if": TokenType.If,
  "else": TokenType.Else,
  "while": TokenType.While,
  "return": TokenType.Return,
  "import": TokenType.Import,
  "true": TokenType.True,
  "false": TokenType.False,
  "null": TokenType.Null,
};

export class Lexer {
  private source: string;
  private tokens: Token[] = [];
  private current: number = 0;

  constructor(source: string) {
    this.source = source;
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private advance(): string {
    return this.source[this.current++];
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.current];
  }

  private match(expected: string): boolean {
      if (this.isAtEnd() || this.source[this.current] !== expected) {
          return false;
      }
      this.current++;
      return true;
  }

  private addToken(type: TokenType, value: string) {
    this.tokens.push({ type, value });
  }

  public tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.scanToken();
    }
    this.addToken(TokenType.EOF, "EOF");
    return this.tokens;
  }

  private scanToken() {
    const char = this.advance();
    switch (char) {
      case '(': this.addToken(TokenType.OpenParen, char); break;
      case ')': this.addToken(TokenType.CloseParen, char); break;
      case '{': this.addToken(TokenType.OpenBrace, char); break;
      case '}': this.addToken(TokenType.CloseBrace, char); break;
      case ';': this.addToken(TokenType.Semicolon, char); break;
      case ',': this.addToken(TokenType.Comma, char); break;

      case '+':
      case '-':
      case '*':
        this.addToken(TokenType.BinaryOperator, char);
        break;
      
      case '/':
        if (this.peek() === '/') { // It's a comment
            while(this.peek() !== '\n' && !this.isAtEnd()) this.advance();
        } else {
            this.addToken(TokenType.BinaryOperator, char);
        }
        break;

      case '=':
        this.addToken(this.match('=') ? TokenType.ComparisonOperator : TokenType.Equals, this.match('=') ? '==' : '=');
        break;
      case '!':
        if(this.match('=')) this.addToken(TokenType.ComparisonOperator, '!=');
        break;
      case '<':
        this.addToken(TokenType.ComparisonOperator, this.match('=') ? '<=' : '<');
        break;
      case '>':
        this.addToken(TokenType.ComparisonOperator, this.match('=') ? '>=' : '>');
        break;

      // Skip whitespace
      case ' ':
      case '\r':
      case '\t':
      case '\n':
        break;

      case '"':
        this.string();
        break;

      default:
        if (this.isDigit(char)) {
          this.number();
        } else if (this.isAlpha(char)) {
          this.identifier();
        } else {
          throw new Error(`Lexer Error: Unexpected character: ${char}`);
        }
        break;
    }
  }

  private string() {
    const start = this.current;
    while (this.peek() !== '"' && !this.isAtEnd()) {
      this.advance();
    }
    if (this.isAtEnd()) {
      throw new Error("Lexer Error: Unterminated string.");
    }
    this.advance(); // consume the closing "
    const value = this.source.substring(start, this.current - 1);
    this.addToken(TokenType.String, value);
  }

  private number() {
    const start = this.current - 1;
    while (this.isDigit(this.peek())) {
      this.advance();
    }
    if (this.peek() === '.' && this.isDigit(this.source[this.current + 1])) {
        this.advance(); // consume the .
        while(this.isDigit(this.peek())) this.advance();
    }
    const value = this.source.substring(start, this.current);
    this.addToken(TokenType.Number, value);
  }
  
  private identifier() {
      const start = this.current - 1;
      while(this.isAlphaNumeric(this.peek())) this.advance();
      
      const text = this.source.substring(start, this.current);
      const type = KEYWORDS[text] || TokenType.Identifier;
      this.addToken(type, text);
  }


  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
      return (char >= 'a' && char <= 'z') ||
             (char >= 'A' && char <= 'Z') ||
              char === '_';
  }

  private isAlphaNumeric(char: string): boolean {
      return this.isAlpha(char) || this.isDigit(char);
  }
}