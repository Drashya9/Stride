/** Query keys shared by server components (cache seeding) and client hooks. */
export const boardKey = (slug: string) => ["board", slug] as const;
