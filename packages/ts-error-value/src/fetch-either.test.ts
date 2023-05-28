import { HttpError, fetchEither } from './fetch-either';
import { describe, it, beforeAll, afterAll, afterEach, expect } from 'vitest';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import z from 'zod';

const BASE_URL = 'http://example.com';

const server = setupServer(
  rest.get(`${BASE_URL}/json`, (req, res, ctx) => {
    return res(ctx.json({ name: 'value', email: 'my-email@gmail.com' }));
  }),
  rest.get(`${BASE_URL}/text`, (req, res, ctx) => {
    return res(ctx.text('Some text data'));
  }),
  rest.get(`${BASE_URL}/error`, (req, res, ctx) => {
    return res(ctx.status(500), ctx.json({ error: 'Server error' }));
  }),

  rest.get(`${BASE_URL}/malformed-json`, (req, res, ctx) => {
    return res(ctx.set('Content-Type', 'application/json'), ctx.body('{"value": NaN}'));
  }),

  rest.get(`${BASE_URL}/network-error`, (req, res) => {
    return res.networkError('Network Error Occurred');
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchEither', () => {
  it('should successfully parse json response', async () => {
    const successPayload = z.object({
      name: z.string(),
      email: z.string().email(),
    });
    const exptectedObject = {
      name: 'value',
      email: 'my-email@gmail.com',
    };

    const [error, value] = await fetchEither({
      requestInfo: `${BASE_URL}/json`,
      successPayloadSchema: successPayload,
    });

    expect(error).toBeNull();
    expect(value).toStrictEqual(exptectedObject);
  });

  it('should handle http error responses', async () => {
    const errorPayload = z.object({
      error: z.string(),
    });

    const [error, value] = await fetchEither({
      requestInfo: `${BASE_URL}/error`,
      errorPayloadSchema: errorPayload,
    });

    expect(value).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.type).toEqual('http');

    const httpError = error as HttpError<{ error: string }>;
    expect(httpError.code).toEqual(500);
    expect(httpError.properties).toEqual({ error: 'Server error' });
  });

  it('should handle malformed json', async () => {
    const successPayload = z.object({
      name: z.string(),
      email: z.string().email(),
    });

    const [error, value] = await fetchEither({
      requestInfo: `${BASE_URL}/malformed-json`,
      successPayloadSchema: successPayload,
    });

    expect(value).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.type).toEqual('payload');
    expect(error?.message).toContain('Failed to parse response');
  });

  it('should handle network errors', async () => {
    const successPayload = z.object({
      name: z.string(),
      email: z.string().email(),
    });

    const [error, value] = await fetchEither({
      requestInfo: `${BASE_URL}/network-error`,
      successPayloadSchema: successPayload,
    });

    expect(value).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.type).toEqual('type');
    expect(error?.message).toContain('Failed to fetch');
  });
});
