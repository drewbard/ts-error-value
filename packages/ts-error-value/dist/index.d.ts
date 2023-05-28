import { StatusCodes } from 'http-status-codes';
import { ZodSchema } from 'zod';

type EitherTuple<ErrorObject, Value = unknown> = [ErrorObject, null] | [null, Value];
type BaseError = {
  message: string;
  stack?: string;
};
type UnknownError = BaseError & {
  type: 'unknown';
};

type ResponseParser = 'text' | 'formData' | 'json' | 'blob';
type ResponsePayloadError =
  | UnknownError
  | (BaseError & {
      type: 'payload';
      responseContentType: string | null;
      responseParser?: ResponseParser;
      message: string;
    });
type HttpError<ErrorPayload = unknown> = BaseError & {
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
type FetchEitherOptions<ErrorPayload = unknown, SuccessPayload = unknown> = {
  requestInfo: RequestInfo;
  requestInit?: RequestInit | null;
  errorPayloadSchema?: ZodSchema<ErrorPayload>;
  successPayloadSchema?: ZodSchema<SuccessPayload>;
};
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
declare function fetchEither<ErrorPayload = unknown, SuccessPayload = unknown>({ requestInfo, requestInit, successPayloadSchema, errorPayloadSchema }: FetchEitherOptions<ErrorPayload, SuccessPayload>): Promise<EitherTuple<FetchEitherError<ErrorPayload | unknown>, SuccessPayload | unknown>>;

export { FetchEitherOptions, HttpError, fetchEither };
