export {};

declare global {
  namespace Express {
    interface User {
      userId: number;
      email: string;
      zohoId: string;
      name: string;
      role: string;
    }

    interface Request {
      cookies: {
        invite_token?: string;
        [key: string]: string | undefined;
      };
    }
  }
}
