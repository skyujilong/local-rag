export interface IgnoreConfig {
  default: string[];
  sensitive: string[];
  custom: string[];
}

export function getIgnoreConfig(): IgnoreConfig {
  const customIgnore = (process.env.CUSTOM_IGNORE_PATTERNS || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return {
    default: [
      'node_modules/**',
      '.git/**',
      '.gitignore',
      'dist/**',
      'build/**',
      '.env',
      '.env.*',
      '*.log',
      '.DS_Store',
      'coverage/**',
      '.vscode/**',
      '.idea/**',
      '*.swp',
      '*.swo',
      'Thumbs.db',
    ],
    sensitive: [
      '**/*password*',
      '**/*secret*',
      '**/*private*',
      '**/*key*',
      '**/.aws/**',
      '**/.ssh/**',
      '**/credentials*',
      '**/.env*',
    ],
    custom: customIgnore,
  };
}

export function getAllIgnorePatterns(): string[] {
  const config = getIgnoreConfig();
  return [...config.default, ...config.sensitive, ...config.custom];
}
