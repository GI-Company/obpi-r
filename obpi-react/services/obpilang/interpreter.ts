import {
    ASTNode, Program, Statement, Expression,
    VariableDeclaration, BlockStatement, IfStatement, WhileStatement, FunctionDeclaration, ReturnStatement,
    Identifier, Literal, BinaryExpression, CallExpression
} from './ast';
import { Environment } from './environment';

export class Interpreter {
    private ast: Program;
    private output: (message: string) => void;
    private globalEnv: Environment;

    constructor(ast: Program, outputCallback: (message: string) => void) {
        this.ast = ast;
        this.output = outputCallback;
        this.globalEnv = new Environment();
        
        // Define built-in functions
        this.globalEnv.declare("print", (args: any[]) => {
            const message = args.map(arg => {
                if(arg === null) return "null";
                if(typeof arg === 'object') return JSON.stringify(arg);
                return arg.toString();
            }).join(' ');
            this.output(message);
        });
    }

    public interpret() {
        // First pass: Hoist all function declarations to the global scope
        for (const statement of this.ast.body) {
            if (statement.type === "FunctionDeclaration") {
                this.evaluate(statement, this.globalEnv);
            }
        }
        
        // Second pass: Execute the rest of the code, looking for a 'main' function call
        const mainFunction = this.globalEnv.lookup('main');
        if (mainFunction && typeof mainFunction === 'object' && mainFunction.type === 'user-defined-function') {
            mainFunction.call([]); // Call main with no arguments
        } else {
             throw new Error("Runtime Error: `main` function not found or is not a function.");
        }
    }

    private evaluate(node: ASTNode, env: Environment): any {
        switch (node.type) {
            // Literals just return their value
            case "NumericLiteral":
            case "StringLiteral":
            case "BooleanLiteral":
            case "NullLiteral":
                return (node as Literal).value;

            // Expressions
            case "Identifier":
                return env.lookup((node as Identifier).name);

            case "BinaryExpression":
                return this.evaluateBinaryExpression(node as BinaryExpression, env);

            case "CallExpression":
                return this.evaluateCallExpression(node as CallExpression, env);

            // Statements
            case "Program":
                 // Program is handled by the `interpret` method, but for completeness:
                let lastResult;
                for (const stmt of (node as Program).body) {
                    lastResult = this.evaluate(stmt, env);
                }
                return lastResult;

            case "BlockStatement":
                return this.evaluateBlockStatement(node as BlockStatement, env);

            case "ExpressionStatement":
                return this.evaluate((node as any).expression, env);

            case "VariableDeclaration":
                const value = this.evaluate((node as VariableDeclaration).value, env);
                return env.declare((node as VariableDeclaration).identifier.name, value);

            case "IfStatement":
                return this.evaluateIfStatement(node as IfStatement, env);

            case "WhileStatement":
                return this.evaluateWhileStatement(node as WhileStatement, env);

            case "FunctionDeclaration":
                const fn = {
                    type: "user-defined-function",
                    name: (node as FunctionDeclaration).name.name,
                    params: (node as FunctionDeclaration).params,
                    body: (node as FunctionDeclaration).body,
                    declarationEnv: env,
                    call: (args: any[]) => {
                        const callEnv = new Environment(fn.declarationEnv);
                        for (let i = 0; i < fn.params.length; i++) {
                            callEnv.declare(fn.params[i].name, args[i]);
                        }
                        
                        try {
                            this.evaluate(fn.body, callEnv);
                        } catch (returnValue) {
                            if (returnValue instanceof ReturnValue) {
                                return returnValue.value;
                            }
                            throw returnValue; // Re-throw other errors
                        }
                        return null; // Implicit return
                    }
                };
                return env.declare(fn.name, fn);
            
            case "ReturnStatement":
                 const returnValue = (node as ReturnStatement).argument ? this.evaluate((node as ReturnStatement).argument!, env) : null;
                 throw new ReturnValue(returnValue);

            default:
                throw new Error(`Unhandled AST node type: ${node.type}`);
        }
    }

    private evaluateBlockStatement(block: BlockStatement, env: Environment): any {
        const blockEnv = new Environment(env);
        let lastResult;
        for (const statement of block.body) {
            lastResult = this.evaluate(statement, blockEnv);
        }
        return lastResult;
    }

    private evaluateIfStatement(stmt: IfStatement, env: Environment): any {
        const test = this.evaluate(stmt.test, env);
        if (test) {
            return this.evaluate(stmt.consequent, env);
        } else if (stmt.alternate) {
            return this.evaluate(stmt.alternate, env);
        }
        return null;
    }
    
    private evaluateWhileStatement(stmt: WhileStatement, env: Environment): any {
        let result;
        while (this.evaluate(stmt.test, env)) {
            result = this.evaluate(stmt.body, env);
        }
        return result;
    }

    private evaluateCallExpression(expr: CallExpression, env: Environment): any {
        const callee = env.lookup(expr.callee.name);
        const args = expr.args.map(arg => this.evaluate(arg, env));
        
        if (typeof callee === 'function') { // Built-in function
            return callee(args);
        } else if (callee && callee.type === 'user-defined-function') { // User-defined function
            return callee.call(args);
        }
        
        throw new Error(`Runtime Error: "${expr.callee.name}" is not a function.`);
    }

    private evaluateBinaryExpression(expr: BinaryExpression, env: Environment): any {
        const left = this.evaluate(expr.left, env);
        const right = this.evaluate(expr.right, env);

        // Type checks for arithmetic operations
        if (["+", "-", "*", "/"].includes(expr.operator)) {
            if (typeof left !== 'number' || typeof right !== 'number') {
                // Allow string concatenation
                if(expr.operator === '+') return String(left) + String(right);
                throw new Error("Runtime Error: Operands must be numbers for arithmetic operations.");
            }
        }

        switch (expr.operator) {
            // Arithmetic
            case "+": return left + right;
            case "-": return left - right;
            case "*": return left * right;
            case "/": return left / right;
            
            // Comparison
            case "==": return left === right;
            case "!=": return left !== right;
            case "<": return left < right;
            case ">": return left > right;
            case "<=": return left <= right;
            case ">=": return left >= right;

            default:
                throw new Error(`Unhandled binary operator: ${expr.operator}`);
        }
    }
}

// A special class to handle return statements, using exceptions for control flow.
class ReturnValue {
    constructor(public value: any) {}
}