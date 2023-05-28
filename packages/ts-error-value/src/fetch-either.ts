import { type StatusCodes, getReasonPhrase } from 'http-status-codes';
import { type BaseError, type UnknownError, type EitherTuple } from '../types';
import { match } from 'ts-pattern';
import { matchRegex } from '../utils';
import { type ZodSchema } from 'zod';

type ResponseParser = 'text' | 'formData' | 'json' | 'blob';

type ResponsePayloadError =
  | UnknownError
  | (BaseError & {
      type: 'payload';
      responseContentType: string | null;
      responseParser?: ResponseParser;
      message: string;
    });

export type HttpError<ErrorPayload = unknown> = BaseError & {
  type: 'http';
  code: StatusCodes;
  properties?: ErrorPayload;
};

type ResponseValidationError = BaseError & {
  type: 'response-validation';
  input: unknown;
  errors: {
    path: string;
    message: string;
  }[];
};

type FetchError = BaseError & {
  type: 'abort' | 'type' | 'syntax';
};

type FetchEitherError<HttpErrorPayload = unknown> = HttpError<HttpErrorPayload> | ResponseValidationError | UnknownError | ResponsePayloadError | FetchError;

export type FetchEitherOptions<ErrorPayload = unknown, SuccessPayload = unknown> = {
  requestInfo: RequestInfo;
  requestInit?: RequestInit | null;
  errorPayloadSchema?: ZodSchema<ErrorPayload>;
  successPayloadSchema?: ZodSchema<SuccessPayload>;
};

async function extractPayload(response: Response, responseType: ResponseParser): Promise<EitherTuple<ResponsePayloadError, unknown>> {
  try {
    const extractedBody = await match<ResponseParser, Promise<unknown>>(responseType)
      .with('text', () => response.text())
      .with('formData', () => response.formData())
      .with('json', () => response.json())
      .with('blob', () => response.blob())
      .exhaustive();

    return [null, extractedBody];
  } catch (e: unknown) {
    let error: ResponsePayloadError = {
      type: 'unknown',
      message: 'unkown error',
    };

    if (e instanceof TypeError || e instanceof SyntaxError) {
      error = {
        type: 'payload',
        stack: e.stack,
        responseContentType: response.headers.get('Content-Type'),
        responseParser: responseType,
        message: `Failed to parse response`,
      };

      return [error, null];
    }

    if (e instanceof Error) {
      error = {
        type: 'unknown',
        stack: e.stack,
        message: e.message,
      };
    }

    return [error, null];
  }
}

async function getResponsePayload(response: Response): Promise<EitherTuple<ResponsePayloadError>> {
  const contentType = response.headers.get('Content-Type');
  const [error, payload] = await match(contentType)
    .with(matchRegex(/application\/json/), () => extractPayload(response, 'json'))
    .with(matchRegex(/text\/plain/), () => extractPayload(response, 'text'))
    .with(matchRegex(/text\/html/), () => extractPayload(response, 'text'))
    .with(matchRegex(/application\/xml/), () => extractPayload(response, 'text'))
    .with(matchRegex(/multipart\/form-data/), () => extractPayload(response, 'formData'))
    .with(matchRegex(/application\/x-www-form-urlencoded/), () => extractPayload(response, 'formData'))
    .with(matchRegex(/image\/.*/), () => extractPayload(response, 'blob'))
    .otherwise(async () => {
      const e: ResponsePayloadError = {
        type: 'payload',
        responseContentType: contentType,
        message: `unsupported content type: ${contentType}`,
      };

      return [e, null];
    });

  if (error) {
    return [error, null];
  }
  return [null, payload];
}

/**
 * Fetches a resource and handles the response, parsing and validating the payload.
 *
 * @template ErrorPayload - The type of an error response payload. This can be auto inferred from the passed in error schema.
 * @template SuccessPayload - The type of a successful response payload. This can be auto inferred from the passed in success schema.
 *
 * @param {FetchEitherOptions<ErrorPayload, SuccessPayload>} options - The options for the fetch request and response validation.
 *   - `requestInfo`: The URL of the resource which should be fetched, or a Request object.
 *   - `[requestInit]`: An options object containing any custom settings that you want to apply to the request.
 *   - `[errorPayloadSchema]`: A Zod schema to validate the error response payload. If the validation fails, a `ResponseValidationError` is returned.
 *   - `[successPayloadSchema]`: A Zod schema to validate the successful response payload. If the validation fails, a `ResponseValidationError` is returned.
 *
 * @returns {Promise<EitherTuple<FetchEitherError<ErrorPayload | unknown>, SuccessPayload | unknown>>} - A promise that resolves to a tuple where the first element is the error object (null if no error) and the second element is the response payload (null if error).
 *
 * @throws {FetchEitherError} - Can return different types of errors including `HttpError`, `FetchError`, `UnknownError`, `SyntaxError`, and `ResponseValidationError`.
 *
 * @example
 * // This example fetches a resource from 'https://api.example.com/resource'. The 'successPayloadSchema' is used to validate the response.
 * const [error, data] = await fetchEither({
 *   requestInfo: 'https://api.example.com/resource',
 *   successPayloadSchema: zod.object({
 *     id: zod.number(),
 *     name: zod.string(),
 *   }),
 * });
 *
 * if (error) {
 *   console.error('Failed to fetch resource:', error);
 * } else {
 *   console.log('Fetched resource:', data);
 * }
 *
 * @see [MDN - Fetch API]{@link https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API}
 * @see [Zod - Runtime Validation Library]{@link https://github.com/colinhacks/zod}
 */
export async function fetchEither<ErrorPayload = unknown, SuccessPayload = unknown>({ requestInfo, requestInit, successPayloadSchema, errorPayloadSchema }: FetchEitherOptions<ErrorPayload, SuccessPayload>): Promise<EitherTuple<FetchEitherError<ErrorPayload | unknown>, SuccessPayload | unknown>> {
  try {
    const response = await fetch(requestInfo, requestInit ?? undefined);

    if (!response.ok) {
      const httpError: HttpError = {
        type: 'http',
        code: response.status,
        message: getReasonPhrase(response.status),
      };

      const [payloadError, payload] = await getResponsePayload(response);
      if (payloadError) return [payloadError, null];

      if (errorPayloadSchema) {
        const safeParseResponse = errorPayloadSchema.safeParse(payload);
        if (safeParseResponse.success) {
          httpError.properties = safeParseResponse.data;
          return [httpError, null];
        }

        const zodError = safeParseResponse.error;
        const validationError: ResponseValidationError = {
          type: 'response-validation',
          stack: zodError.stack,
          input: payload,
          message: 'Response schema failed to parse the body',
          errors: zodError.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        };

        return [validationError, null];
      } else {
        httpError.properties = payload;
      }
      return [httpError, null];
    }

    const [error, body] = await getResponsePayload(response);
    if (error) return [error, null];

    if (body && successPayloadSchema) {
      const safeParseResponse = successPayloadSchema.safeParse(body);
      if (safeParseResponse.success) {
        return [null, safeParseResponse.data];
      } else {
        const zodError = safeParseResponse.error;
        const validationError: ResponseValidationError = {
          type: 'response-validation',
          stack: zodError.stack,
          input: body,
          message: 'Response schema failed to parse the body',
          errors: zodError.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        };

        return [validationError, null];
      }
    }

    return [null, body];
  } catch (error: unknown) {
    if (error instanceof DOMException) {
      const errorObj: FetchError | UnknownError = match<DOMException, FetchError | UnknownError>(error)
        .with({ name: 'AbortError' }, (e) => ({
          type: 'abort',
          stack: e.stack,
          message: e.message,
        }))
        .otherwise((e) => ({ type: 'unknown', stack: e.stack, message: e.message }));

      return [errorObj, null];
    }

    if (error instanceof TypeError) {
      const e: FetchError = {
        type: 'type',
        stack: error.stack,
        message: error.message,
      };
      return [e, null];
    }

    if (error instanceof SyntaxError) {
      const errorObj: FetchError = {
        type: 'syntax',
        stack: error.stack,
        message: error.message,
      };
      return [errorObj, null];
    }

    if (error instanceof Error) {
      const errorObj: UnknownError = {
        type: 'unknown',
        stack: error.stack,
        message: error.message,
      };

      return [errorObj, null];
    }

    return [
      {
        type: 'unknown',
        message: 'unknown error',
      },
      null,
    ];
  }
}
