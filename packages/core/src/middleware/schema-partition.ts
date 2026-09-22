/**
 * Schema Partitioning Algorithm (Ported from Airis MCP Gateway)
 * Strips nested object properties from JSON schemas on tools/list to minimize context window consumption.
 */

export function partitionSchema(fullSchema: any): any {
  if (!fullSchema || fullSchema.type !== 'object' || !fullSchema.properties) {
    return fullSchema;
  }

  const topLevelProperties: Record<string, any> = {};
  for (const [key, value] of Object.entries<any>(fullSchema.properties)) {
    topLevelProperties[key] = {
      type: value.type,
      description: value.description,
      ...(value.enum ? { enum: value.enum } : {}),
      ...(value.default !== undefined ? { default: value.default } : {}),
    };
  }

  return {
    type: 'object',
    properties: topLevelProperties,
    required: fullSchema.required || [],
  };
}
