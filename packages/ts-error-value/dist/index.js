"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  fetchEither: () => fetchEither
});
module.exports = __toCommonJS(src_exports);

// src/fetch-either.ts
var import_http_status_codes = require("http-status-codes");
var import_ts_pattern2 = require("ts-pattern");

// utils.ts
var import_ts_pattern = require("ts-pattern");
var { when } = import_ts_pattern.P;
var matchRegex = (expr) => when((str) => expr.test(str));

// src/fetch-either.ts
async function extractPayload(response, responseType) {
  try {
    const extractedBody = await (0, import_ts_pattern2.match)(responseType).with("text", () => response.text()).with("formData", () => response.formData()).with("json", () => response.json()).with("blob", () => response.blob()).exhaustive();
    return [null, extractedBody];
  } catch (e) {
    let error = {
      type: "unknown",
      message: "unkown error"
    };
    if (e instanceof TypeError || e instanceof SyntaxError) {
      error = {
        type: "payload",
        stack: e.stack,
        responseContentType: response.headers.get("Content-Type"),
        responseParser: responseType,
        message: `Failed to parse response`
      };
      return [error, null];
    }
    if (e instanceof Error) {
      error = {
        type: "unknown",
        stack: e.stack,
        message: e.message
      };
    }
    return [error, null];
  }
}
async function getResponsePayload(response) {
  const contentType = response.headers.get("Content-Type");
  const [error, payload] = await (0, import_ts_pattern2.match)(contentType).with(matchRegex(/application\/json/), () => extractPayload(response, "json")).with(matchRegex(/text\/plain/), () => extractPayload(response, "text")).with(matchRegex(/text\/html/), () => extractPayload(response, "text")).with(matchRegex(/application\/xml/), () => extractPayload(response, "text")).with(matchRegex(/multipart\/form-data/), () => extractPayload(response, "formData")).with(matchRegex(/application\/x-www-form-urlencoded/), () => extractPayload(response, "formData")).with(matchRegex(/image\/.*/), () => extractPayload(response, "blob")).otherwise(async () => {
    const e = {
      type: "payload",
      responseContentType: contentType,
      message: `unsupported content type: ${contentType}`
    };
    return [e, null];
  });
  if (error) {
    return [error, null];
  }
  return [null, payload];
}
async function fetchEither({ requestInfo, requestInit, successPayloadSchema, errorPayloadSchema }) {
  try {
    const response = await fetch(requestInfo, requestInit ?? void 0);
    if (!response.ok) {
      const httpError = {
        type: "http",
        code: response.status,
        message: (0, import_http_status_codes.getReasonPhrase)(response.status)
      };
      const [payloadError, payload] = await getResponsePayload(response);
      if (payloadError)
        return [payloadError, null];
      if (errorPayloadSchema) {
        const safeParseResponse = errorPayloadSchema.safeParse(payload);
        if (safeParseResponse.success) {
          httpError.properties = safeParseResponse.data;
          return [httpError, null];
        }
        const zodError = safeParseResponse.error;
        const validationError = {
          type: "response-validation",
          stack: zodError.stack,
          input: payload,
          message: "Response schema failed to parse the body",
          errors: zodError.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        };
        return [validationError, null];
      } else {
        httpError.properties = payload;
      }
      return [httpError, null];
    }
    const [error, body] = await getResponsePayload(response);
    if (error)
      return [error, null];
    if (body && successPayloadSchema) {
      const safeParseResponse = successPayloadSchema.safeParse(body);
      if (safeParseResponse.success) {
        return [null, safeParseResponse.data];
      } else {
        const zodError = safeParseResponse.error;
        const validationError = {
          type: "response-validation",
          stack: zodError.stack,
          input: body,
          message: "Response schema failed to parse the body",
          errors: zodError.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        };
        return [validationError, null];
      }
    }
    return [null, body];
  } catch (error) {
    if (error instanceof DOMException) {
      const errorObj = (0, import_ts_pattern2.match)(error).with({ name: "AbortError" }, (e) => ({
        type: "abort",
        stack: e.stack,
        message: e.message
      })).otherwise((e) => ({ type: "unknown", stack: e.stack, message: e.message }));
      return [errorObj, null];
    }
    if (error instanceof TypeError) {
      const e = {
        type: "type",
        stack: error.stack,
        message: error.message
      };
      return [e, null];
    }
    if (error instanceof SyntaxError) {
      const errorObj = {
        type: "syntax",
        stack: error.stack,
        message: error.message
      };
      return [errorObj, null];
    }
    if (error instanceof Error) {
      const errorObj = {
        type: "unknown",
        stack: error.stack,
        message: error.message
      };
      return [errorObj, null];
    }
    return [
      {
        type: "unknown",
        message: "unknown error"
      },
      null
    ];
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  fetchEither
});
