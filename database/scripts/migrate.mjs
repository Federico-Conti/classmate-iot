import { createRequire } from "node:module";
import { parseArguments, requiredArgument } from "./arguments.mjs";

const require = createRequire(import.meta.url);
const { ClassMateDatabase } = require("../lib/classmate-db.cjs");

const argumentsMap = parseArguments(process.argv.slice(2));
const databasePath = requiredArgument(argumentsMap, "database");
const database = new ClassMateDatabase(databasePath);
const health = database.health();
database.close();

console.log(JSON.stringify({ database: databasePath, ...health }));
