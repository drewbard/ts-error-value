import { P } from 'ts-pattern';

const { when } = P;

export const matchRegex = (expr: RegExp) => when((str: string): str is never => expr.test(str));
