/**
 * Runtime verification and fix for header positioning on iOS
 * Ensures header uses position: fixed and has proper safe area padding
 * even if CSS fails in production builds
 */

export function verifyAndFixHeaderPositioning(): void {
  try {
    // Only run on iOS devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (!isIOS) {
      return; // Not iOS, skip verification
    }
    
    const header = document.getElementById('stixlytopheader');
    if (!header) {
      console.warn('[Stixly] Header not found in DOM');
      return;
    }
    
    const computedStyle = window.getComputedStyle(header);
    const position = computedStyle.position;
    const paddingTop = computedStyle.paddingTop;
    const top = computedStyle.top;
    
    let needsFix = false;
    
    // Check if position is fixed
    if (position !== 'fixed') {
      console.error('[Stixly] Header position is not fixed! Current:', position, '- Forcing fix...');
      header.style.setProperty('position', 'fixed', 'important');
      header.style.setProperty('top', '0', 'important');
      header.style.setProperty('left', '0', 'important');
      header.style.setProperty('right', '0', 'important');
      header.style.setProperty('z-index', '999', 'important');
      needsFix = true;
    }
    
    // Check if safe area padding is applied
    if (paddingTop === '0px' || paddingTop === '0' || !paddingTop.includes('env')) {
      // Try to get actual safe area value
      const testElement = document.createElement('div');
      testElement.style.position = 'fixed';
      testElement.style.top = '0';
      testElement.style.left = '0';
      testElement.style.width = '1px';
      testElement.style.height = '1px';
      testElement.style.paddingTop = 'env(safe-area-inset-top)';
      document.body.appendChild(testElement);
      
      const testComputed = window.getComputedStyle(testElement);
      const safeAreaValue = testComputed.paddingTop;
      document.body.removeChild(testElement);
      
      // If safe area is not 0px, use it; otherwise use fallback
      const safeArea = (safeAreaValue && safeAreaValue !== '0px') ? safeAreaValue : '44px';
      
      console.warn('[Stixly] Safe area not detected, using:', safeArea);
      header.style.setProperty('padding-top', safeArea, 'important');
      needsFix = true;
    }
    
    if (needsFix) {
      console.log('[Stixly] Header position fixed successfully');
    } else {
      console.log('[Stixly] Header position verified:', { position, paddingTop });
    }
  } catch (e) {
    console.warn('[Stixly] Failed to verify/fix header positioning:', e);
  }
}

/**
 * Initialize header fix verification
 * Runs multiple times to catch issues during hydration
 */
export function initHeaderFix(): void {
  // Run immediately if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verifyAndFixHeaderPositioning);
  } else {
    verifyAndFixHeaderPositioning();
  }
  
  // Also run after a delay to catch React hydration issues
  setTimeout(verifyAndFixHeaderPositioning, 100);
  setTimeout(verifyAndFixHeaderPositioning, 1000);
  
  // Run when React hydration is complete (if applicable)
  if (typeof window !== 'undefined') {
    window.addEventListener('load', verifyAndFixHeaderPositioning);
  }
}

