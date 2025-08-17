import { sampleFunction } from '@src/sample-function';
import '@src/content-script-coordinator.js';
import { JobFormDetector } from '@src/job-form-detector';

console.log('[Job Autofill] Content script loaded - scanning for job application forms');

// Initialize form detection
const formDetector = new JobFormDetector();

// Start monitoring for forms
formDetector.startMonitoring();

void sampleFunction();
