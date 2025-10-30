export class Environment {
    private parent: Environment | null;
    private values: Map<string, any> = new Map();

    constructor(parent?: Environment) {
        this.parent = parent || null;
    }

    // Declares a variable in the current scope.
    declare(name: string, value: any): any {
        if (this.values.has(name)) {
            throw new Error(`Variable "${name}" has already been declared in this scope.`);
        }
        this.values.set(name, value);
        return value;
    }

    // Assigns a value to an existing variable.
    assign(name: string, value: any): any {
        const env = this.resolve(name);
        if (!env) {
            throw new Error(`Cannot assign to undeclared variable "${name}".`);
        }
        env.values.set(name, value);
        return value;
    }

    // Retrieves the value of a variable.
    lookup(name: string): any {
        const env = this.resolve(name);
        if (!env) {
            throw new Error(`Cannot access undeclared variable "${name}".`);
        }
        return env.values.get(name);
    }

    // Finds the environment where a variable is defined.
    private resolve(name: string): Environment | null {
        if (this.values.has(name)) {
            return this;
        }
        if (this.parent) {
            return this.parent.resolve(name);
        }
        return null;
    }
}