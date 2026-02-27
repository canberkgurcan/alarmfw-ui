declare namespace NodeJS {
  interface ProcessEnv {
    readonly API_URL?: string;
    readonly NEXT_PUBLIC_API_URL?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
