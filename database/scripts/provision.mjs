import fs from "node:fs";
import { createRequire } from "node:module";
import { parseArguments, requiredArgument } from "./arguments.mjs";

const require = createRequire(import.meta.url);
const { ClassMateDatabase } = require("../lib/classmate-db.cjs");

const argumentsMap = parseArguments(process.argv.slice(2));
const databasePath = requiredArgument(argumentsMap, "database");
const seedPath = requiredArgument(argumentsMap, "seed");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const database = new ClassMateDatabase(databasePath);
const result = database.provision(seed);
database.close();

console.log(JSON.stringify({ database: databasePath, seed: seedPath, ...result }));
