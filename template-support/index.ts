/* eslint-disable import/prefer-default-export */
import * as fs from "fs";
import * as path from "path";
import { safeLoad } from "js-yaml";
import Ajv from "ajv";
import dotenv from "dotenv";

dotenv.config();

function parseYAMLorJSON(buf: Buffer | string) {
    try {
        return safeLoad(buf.toString());
    } catch (e) {
        return JSON.parse(buf.toString());
    }
}

function loadAdaptableConfigSchema() {
    const configPath = path.join(".", ".adaptable", "config.schema.json");
    if (!fs.existsSync(configPath)) return undefined;
    const schemaText = fs.readFileSync(configPath);
    const schema = JSON.parse(schemaText.toString());
    if (typeof schema !== "object" || Array.isArray(schema)) {
        throw new Error("Invalid Adaptable template config schema, not an object");
    }
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    return { schema, validate };
}

function loadRawAdaptableConfig() {
    const confJSON = process.env.ADAPTABLE_TEMPLATE_CONFIG_JSON;
    const confPath = process.env.ADAPTABLE_TEMPLATE_CONFIG_PATH;
    if (confJSON) return parseYAMLorJSON(confJSON);
    if (confPath) return parseYAMLorJSON(fs.readFileSync(confPath));
    throw new Error("No ADAPTABLE_TEMPLATE_CONFIG_JSON or ADAPTABLE_TEMPLATE_CONFIG_PATH set");
}

/**
 * Loads and validates the Adaptable config
 *
 * @returns An object corresponding to the validated configuration
 *
 * This function will load the adaptable config, searching through
 * the known places that the config may be, starting with the
 * `ADAPTABLE_TEMPLATE_CONFIG_JSON` environment variable, and then
 * the file referenced in `ADAPTABLE_TEMPLATE_CONFIG_PATH`.  The data
 * may be in YAML or JSON format.
 *
 * It will then validate the config data according
 * to the template's schema as found in `<template dir>/.adaptable/config.json.schema`
 * `config.json.schema` should be a JSON schema object in either YAML
 * or JSON format.
 *
 * If there is no schema, no validation is performed.  If there is no
 * config specified, the function will throw an appropriate error.  The
 * function will also throw with any validation errors if the data
 * does not correspond to the template's config schema.
 *
 * @public
 */
export function loadAdaptableConfig<T>(): T {
    const config = loadRawAdaptableConfig();
    const schema = loadAdaptableConfigSchema();
    if (schema === undefined) return config;
    const { validate } = schema;
    if (!validate(config)) {
        const { errors } = validate;
        if (errors == null) throw new Error("Unknown Adaptable config validation error");
        throw new Error(`Errors loading Adaptable template config:\n${errors.map((e) => `  ${e.message}`).join("\n")}`);
    }
    return config as T;
}
