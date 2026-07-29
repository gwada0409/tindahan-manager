export class AppError extends Error {
  public code: string;

  constructor(message: string, code: string = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}
