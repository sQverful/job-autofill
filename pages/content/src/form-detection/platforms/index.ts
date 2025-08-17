/**
 * Platform-specific form detection modules
 * Exports all platform detectors and their configurations
 */

export { LinkedInFormDetector, LINKEDIN_SELECTORS } from './linkedin';
export type { LinkedInFormSelectors } from './linkedin';

export { IndeedFormDetector, INDEED_SELECTORS } from './indeed';
export type { IndeedFormSelectors } from './indeed';

export { WorkdayFormDetector, WORKDAY_SELECTORS } from './workday';
export type { WorkdayFormSelectors } from './workday';

export { CustomFormDetector, CUSTOM_FORM_PATTERNS } from './custom';
export type { CustomFormPatterns } from './custom';

// Platform detector factory
import type { JobPlatform } from '@extension/shared/lib/types/form-detection';
import { BaseFormDetector } from '../base-detector';

/**
 * Factory function to create platform-specific detectors
 */
export function createPlatformDetector(platform: JobPlatform): BaseFormDetector {
  switch (platform) {
    case 'linkedin':
      return new LinkedInFormDetector();
    case 'indeed':
      return new IndeedFormDetector();
    case 'workday':
      return new WorkdayFormDetector();
    case 'custom':
    default:
      return new CustomFormDetector();
  }
}

/**
 * Detect platform from URL and page content
 */
export function detectPlatform(document: Document = window.document): JobPlatform {
  const url = document.location.href.toLowerCase();
  const hostname = document.location.hostname.toLowerCase();

  if (hostname.includes('linkedin.com')) return 'linkedin';
  if (hostname.includes('indeed.com')) return 'indeed';
  if (url.includes('workday') || document.querySelector('[data-automation-id], [class*="workday"], [id*="workday"]')) return 'workday';

  return 'custom';
}

/**
 * Get all available platform detectors
 */
export function getAllPlatformDetectors(): Record<JobPlatform, BaseFormDetector> {
  return {
    linkedin: new LinkedInFormDetector(),
    indeed: new IndeedFormDetector(),
    workday: new WorkdayFormDetector(),
    custom: new CustomFormDetector()
  };
}