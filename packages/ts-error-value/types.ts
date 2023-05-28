export type EitherTuple<ErrorObject, Value = unknown> = [ErrorObject, null] | [null, Value];

export type BaseError = {
  message: string;
  stack?: string;
};

export type UnknownError = BaseError & {
  type: 'unknown';
};
