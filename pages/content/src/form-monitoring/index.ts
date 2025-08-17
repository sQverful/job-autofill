/**
 * Form Monitoring System
 * Main entry point for form monitoring and change detection
 */

export { FormMonitor, formMonitor } from './form-monitor.js';
export { ChangeDetector, changeDetector } from './change-detector.js';

export type {
  FormChangeEvent,
  FormValidationState,
  MonitoredForm,
} from './form-monitor.js';

export type {
  ChangePattern,
  ChangeAnalysis,
} from './change-detector.js';

/**
 * Initialize the form monitoring system
 */
export function initializeFormMonitoring(): void {
  console.log('Initializing form monitoring system...');

  try {
    // Start form monitoring
    formMonitor.startMonitoring();

    // Setup change detection
    formMonitor.addChangeListener((event) => {
      changeDetector.recordChange(event);
    });

    console.log('Form monitoring system initialized successfully');

  } catch (error: any) {
    console.error('Failed to initialize form monitoring system:', error);
    throw error;
  }
}

/**
 * Destroy the form monitoring system
 */
export function destroyFormMonitoring(): void {
  console.log('Destroying form monitoring system...');

  try {
    formMonitor.stopMonitoring();
    changeDetector.destroy();

    console.log('Form monitoring system destroyed');

  } catch (error: any) {
    console.error('Error destroying form monitoring system:', error);
  }
}

/**
 * Get form monitoring system statistics
 */
export function getFormMonitoringStats(): {
  monitor: ReturnType<typeof formMonitor.getStats>;
  detector: ReturnType<typeof changeDetector.getStats>;
} {
  return {
    monitor: formMonitor.getStats(),
    detector: changeDetector.getStats(),
  };
}