import { makeExecutableSchema } from "@graphql-tools/schema";
import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
import { loadFiles } from "@graphql-tools/load-files";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import dashboardTypeDefs from "./dashboard/typeDefs.js";
import dashboardResolvers from "./dashboard/resolvers.js";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// helper to make a POSIX glob on Windows
const toPosix = (p) => p.split(path.sep).join("/");

async function main() {
  const base = toPosix(__dirname);

  // Build POSIX-style globs so globbing works cross-platform
  const typeDefsGlob   = `${base}/**/typeDefs.js`;
  const resolversGlob  = `${base}/**/resolvers.js`;

  // Force load-files to import via file:// URLs on Windows
  const opts = {
    requireMethod: async (p) => import(pathToFileURL(p).href),
  };

  const typeDefsArray  = await loadFiles(typeDefsGlob, opts);
  const resolversArray = await loadFiles(resolversGlob, opts);

  return { typeDefsArray, resolversArray };
}

const { typeDefsArray, resolversArray } = await main();

const hasDashboardTypeDef = (mergedTypeDefsDoc) =>
  Boolean(
    mergedTypeDefsDoc?.definitions?.some(
      (definition) =>
        definition.kind === "ObjectTypeDefinition" &&
        definition.name?.value === "Query" &&
        definition.fields?.some((field) => field.name?.value === "dashboardStats")
    )
  );

const hasDashboardResolver = (mergedResolversObject) =>
  Boolean(mergedResolversObject?.Query?.dashboardStats);

const mergedTypeDefsCandidate = mergeTypeDefs(typeDefsArray);
const mergedResolversCandidate = mergeResolvers(resolversArray);

const finalTypeDefsArray = hasDashboardTypeDef(mergedTypeDefsCandidate)
  ? typeDefsArray
  : [...typeDefsArray, dashboardTypeDefs];
const finalResolversArray = hasDashboardResolver(mergedResolversCandidate)
  ? resolversArray
  : [...resolversArray, dashboardResolvers];

export const typeDefs = mergeTypeDefs(finalTypeDefsArray);
export const resolvers = mergeResolvers(finalResolversArray);

// If you want the executable schema:
// export const schema = makeExecutableSchema({ typeDefs, resolvers });
