/**
 * Naive UI 主题配置
 */

import type { GlobalThemeOverrides } from 'naive-ui';

/**
 * 亮色主题覆盖配置
 */
export const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#18a058',
    primaryColorHover: '#36ad6a',
    primaryColorPressed: '#0c7a46',
    primaryColorSuppl: '#36ad6a',
    successColor: '#18a058',
    warningColor: '#f0a020',
    errorColor: '#d03050',
    infoColor: '#2080f0',
  },
};

/**
 * 暗色主题覆盖配置
 */
export const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#63e2b7',
    primaryColorHover: '#7ef5ce',
    primaryColorPressed: '#4dc89a',
    primaryColorSuppl: '#7ef5ce',
    successColor: '#63e2b7',
    warningColor: '#f0a020',
    errorColor: '#e57373',
    infoColor: '#70baff',
  },
};
