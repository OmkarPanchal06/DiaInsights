/**
 * Lets the parity script import the app's TypeScript modules using the same
 * extensionless specifiers the bundler uses (`./units`, not `./units.ts`).
 */
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (error) {
    const missing =
      error?.code === "ERR_MODULE_NOT_FOUND" ||
      error?.code === "ERR_UNSUPPORTED_DIR_IMPORT"
    if (missing && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return await next(`${specifier}.ts`, context)
    }
    throw error
  }
}