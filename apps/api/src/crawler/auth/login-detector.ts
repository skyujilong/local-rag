/**
 * 登录检测器 - 检测页面是否需要登录
 */

/**
 * 检测页面是否需要登录
 */
export async function detectLoginRequired(page: any): Promise<boolean> {
  // 常见的登录页面选择器
  const loginSelectors = [
    // 通用登录选择器
    '.login',
    '#login',
    '[data-login]',
    '.login-container',
    '.login-box',
    '.signin',
    '#signin',
    // 表单相关
    'form input[type="password"]',
    'input[name="password"]',
    'input[placeholder*="password" i]',
    'input[placeholder*="密码" i]',
    // 二维码登录
    '.qrcode',
    '.qr-login',
    '[data-qrcode]',
    // 特定网站的登录页面
    '.auth-page',
    '.authentication',
  ];

  // 检查是否存在登录相关元素
  for (const selector of loginSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        // 进一步验证：检查元素是否可见
        const isVisible = await element.isVisible();
        if (isVisible) {
          return true;
        }
      }
    } catch {
      // 选择器无效，继续检查下一个
    }
  }

  // 检查 URL 是否包含登录相关关键词
  const url = page.url();
  const loginKeywords = [
    '/login',
    '/signin',
    '/auth',
    '/oauth',
    'login',
    'signin',
    'auth',
  ];

  const lowerUrl = url.toLowerCase();
  if (loginKeywords.some(keyword => lowerUrl.includes(keyword))) {
    return true;
  }

  // 检查页面标题
  try {
    const title = await page.title();
    const titleLower = title.toLowerCase();
    if (titleLower.includes('login') || titleLower.includes('sign in') || titleLower.includes('登录')) {
      return true;
    }
  } catch {
    // 获取标题失败，忽略
  }

  return false;
}

/**
 * 检测是否为二维码登录页面
 */
export async function isQRCodeLogin(page: any): Promise<boolean> {
  const qrCodeSelectors = [
    '.qrcode img',
    '.qr-login img',
    '[data-qrcode] img',
    'img[src*="qr" i]',
    'img[src*="qrcode" i]',
    'canvas[id*="qr" i]',
  ];

  for (const selector of qrCodeSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        return true;
      }
    } catch {
      // 选择器无效，继续检查下一个
    }
  }

  return false;
}
