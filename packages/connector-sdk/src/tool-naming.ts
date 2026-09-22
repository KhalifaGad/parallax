/**
 * MCP tool naming conventions:
 * Double underscore (<connector>__<tool>) separates connector namespace from tool name.
 * Spec mandates: ^[a-zA-Z0-9_-]{1,64}$
 */

export function createToolName(connectorName: string, toolName: string): string {
  const sanitizedConnector = connectorName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedTool = toolName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${sanitizedConnector}__${sanitizedTool}`;
}

export function parseToolName(fullName: string): { connector: string; tool: string } {
  const firstIndex = fullName.indexOf('__');
  if (firstIndex === -1) {
    return { connector: '', tool: fullName };
  }
  return {
    connector: fullName.slice(0, firstIndex),
    tool: fullName.slice(firstIndex + 2),
  };
}
