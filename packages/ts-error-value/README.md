# ts-error-value

ErrorWise is a TypeScript library centered around error handling as convention similar to golang. This document focuses on the `fetchEither` function, an important function of the library designed to make a fetch request, validate the response, and gracefully handle errors.

## Installation

To install the ErrorWise library, run the following command in your terminal:

```bash
npm install ts-error-value
```

or with yarn

```bash
yarn add ts-error-value
```

## Usage

To use the `fetchEither` function, first import it:

```typescript
import { fetchEither } from 'errorwise';
```

The function signature is as follows:

```typescript
fetchEither<ErrorPayload = unknown, SuccessPayload = unknown>(
  options: FetchEitherOptions<ErrorPayload, SuccessPayload>
): Promise<EitherTuple<FetchEitherError<ErrorPayload | unknown>, SuccessPayload | unknown>>;
```

Where FetchEitherOptions is an object with the following properties:

- requestInfo (required): The URL of the resource which should be fetched, or a Request object.
- requestInit (optional): An options object containing any custom settings that you want to apply to the request.
- errorPayloadSchema (optional): A Zod schema to validate the error response payload. If the validation fails, a ResponseValidationError is returned.
- successPayloadSchema (optional): A Zod schema to validate the successful response payload. If the validation fails, a ResponseValidationError is returned.

## Example Usage

```typescript
import { zod } from 'zod';
import { fetchEither } from 'errorwise';

async function fetchData() {
  const [error, data] = await fetchEither({
    requestInfo: 'https://api.example.com/resource',
    successPayloadSchema: zod.object({
      id: zod.number(),
      name: zod.string(),
    }),
  });

  if (error) {
    console.error('Failed to fetch resource:', error);
  } else {
    console.log('Fetched resource:', data);
  }
}
```

In this example, we fetch data from the provided URL and validate the response payload with a Zod schema. If the response payload validation fails, the function returns an error.

## Error Handling

fetchEither returns an EitherTuple, where the first element is the error object (null if no error), and the second element is the response payload (null if error). The FetchEitherError object can be one of the following types:

- HttpError: Error related to the HTTP response, such as a non-200 status code.
- ResponseValidationError: Error that occurs when the response validation against a provided schema fails.
- FetchError: Error that occurs during the fetch request. This can include network errors, abort errors, etc.
- UnknownError: Any other unknown error.

You can use the ts-pattern library to handle these different error types in a type-safe manner. Here's an example:

```typescript
import { zod } from 'zod';
import { fetchEither } from 'errorwise';
import { match } from 'ts-pattern';

async function fetchData() {
  const [error, data] = await fetchEither({
    requestInfo: 'https://api.example.com/resource',
    successPayloadSchema: zod.object({
      id: zod.number(),
      name: zod.string(),
    }),
  });

  match(error)
    .with({ type: 'http' }, (httpError) => {
      // Handle HTTP errors
      console.error('HTTP Error:', httpError.message);
    })
    .with({ type: 'responseValidation' }, (validationError) => {
      // Handle validation errors
      console.error('Validation Error:', validationError.message);
    })
    .with({ type: 'fetch' }, (fetchError) => {
      // Handle fetch errors
      console.error('Fetch Error:', fetchError.message);
    })
    .with({ type: 'unknown' }, (unknownError) => {
      // Handle unknown errors
      console.error('Unknown Error:', unknownError.message);
    })
    .otherwise(() => {
      // This branch is executed if no other branches matched
      console.log('No error, fetched data:', data);
    });
}
```

In this example, the `ts-pattern` library is used to match and handle the different types of errors that `fetchEither` can return in a type-safe manner.

## Error Types

`fetchEither` can return different types of error objects as part of the `EitherTuple`. Here is a description of each error type, along with its TypeScript interface:

1. `HttpError`: This error occurs when the HTTP response indicates failure, such as a non-200 status code.

```typescript
interface HttpError {
  type: 'http';
  code: number;
  message: string;
  properties?: unknown;
}
```

2. `ResponseValidationError`: This error occurs when the response validation against the provided Zod schema fails.

```typescript
interface ResponseValidationError {
  type: 'response-validation';
  stack?: string;
  input: unknown;
  message: string;
  errors: { path: string; message: string }[];
}
```

3. `FetchError`: This error occurs during the fetch request and can include network errors, abort errors, etc.

```typescript
interface FetchError {
  type: 'abort' | 'type' | 'syntax';
  stack?: string;
  message: string;
}
```

4. `UnknownError`: This error is a catch-all for any other unknown error.

```typescript
interface UnknownError {
  type: 'unknown';
  stack?: string;
  message: string;
}
```

Remember that the first element of the EitherTuple returned by fetchEither will be null if there's no error. If an error does occur, it will be an instance of one of these error types
