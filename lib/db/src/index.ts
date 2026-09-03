import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: any = null;
let db: any = null;

function createQueryMock(): any {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: any) => any) => Promise.resolve([]).then(resolve);
      }
      if (prop === "catch") {
        return (reject: (v: any) => any) => Promise.resolve([]).catch(reject);
      }
      if (typeof prop === "symbol" || prop === "inspect" || prop === "valueOf" || prop === "toString") {
        return () => "";
      }
      return (..._args: any[]) => new Proxy(() => {}, handler);
    },
    apply() {
      return new Proxy(() => {}, handler);
    },
  };
  return new Proxy(() => {}, handler);
}

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
  } catch (error) {
    console.warn("[AI Studio] Database connection error - falling back to mock:", error);
  }
}

if (!db) {
  console.warn("[AI Studio] DATABASE_URL not set - using mock database layer");
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
  };
  db = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === "query") {
        return new Proxy({}, { get: () => noOp });
      }
      return createQueryMock();
    },
  });
}

export { pool, db };
export * from "./schema";
