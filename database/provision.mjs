import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ClassMateDatabase } = require("./classmate-db.cjs");

const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
    const argument = process.argv[index];
    const value = process.argv[index + 1];
    if (!argument.startsWith("--") || !value || value.startsWith("--")) {
        throw new Error(`Invalid argument: ${argument}`);
    }
    argumentsMap.set(argument.slice(2), value);
}
const databasePath = argumentsMap.get("database");
const seedPath = argumentsMap.get("seed");
if (!databasePath || !seedPath) {
    throw new Error("Both --database and --seed are required");
}
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const database = new ClassMateDatabase(databasePath);
const result = database.provision(seed);
database.close();

console.log(JSON.stringify({ database: databasePath, seed: seedPath, ...result }));
