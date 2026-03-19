export interface MCPServerConfig {
  apiBaseUrl: string;
  dataPath: string;
  port: number;
  host: string;
}

export function getMCPConfig(): MCPServerConfig {
  return {
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
    dataPath: process.env.DATA_PATH || './apps/api/data',
    port: parseInt(process.env.API_PORT || '3001'),
    host: process.env.API_HOST || 'localhost',
  };
}
