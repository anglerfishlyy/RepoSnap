export function snapRepo(
  rootDir?: string,
  depth?: number,
  includeFiles?: boolean,
  ignoreFn?: (name: string) => boolean
): Promise<string>;
