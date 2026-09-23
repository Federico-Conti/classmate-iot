export function parseArguments(argv) {
    const argumentsMap = new Map();
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (!argument.startsWith("--")) {
            throw new Error(`Unexpected argument: ${argument}`);
        }
        const key = argument.slice(2);
        const value = argv[index + 1];
        if (!value || value.startsWith("--")) {
            argumentsMap.set(key, true);
        } else {
            argumentsMap.set(key, value);
            index += 1;
        }
    }
    return argumentsMap;
}

export function requiredArgument(argumentsMap, key) {
    const value = argumentsMap.get(key);
    if (typeof value !== "string" || value === "") {
        throw new Error(`Missing required argument: --${key}`);
    }
    return value;
}
