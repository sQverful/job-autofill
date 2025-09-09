/**
 * Animation state types for visual feedback
 */

// Animation state types
export type AnimationState = 'idle' | 'loading' | 'success' | 'error' | 'in-progress';

export type TransitionState = 'entering' | 'entered' | 'exiting' | 'exited';

// Autofill animation states
export interface AutofillAnimationState {
  isActive: boolean;
  currentField?: string;
  progress: number; // 0-100
  state: AnimationState;
  startTime?: Date;
  duration?: number; // milliseconds
}

// Form field animation states
export interface FieldAnimationState {
  fieldId: string;
  selector: string;
  state: AnimationState;
  isHighlighted: boolean;
  isFocused: boolean;
  hasError: boolean;
  transitionState: TransitionState;
}

// Loading animation configuration
export interface LoadingAnimationConfig {
  type: 'spinner' | 'progress' | 'skeleton' | 'pulse';
  size: 'small' | 'medium' | 'large';
  color?: string;
  duration?: number; // milliseconds
  infinite: boolean;
}

// Transition animation configuration
export interface TransitionAnimationConfig {
  type: 'fade' | 'slide' | 'scale' | 'bounce';
  direction?: 'up' | 'down' | 'left' | 'right';
  duration: number; // milliseconds
  easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  delay?: number; // milliseconds
}

// Success animation configuration
export interface SuccessAnimationConfig {
  type: 'checkmark' | 'confetti' | 'pulse' | 'glow';
  duration: number; // milliseconds
  color?: string;
  intensity: 'subtle' | 'normal' | 'strong';
}

// Error animation configuration
export interface ErrorAnimationConfig {
  type: 'shake' | 'flash' | 'bounce' | 'highlight';
  duration: number; // milliseconds
  color?: string;
  intensity: 'subtle' | 'normal' | 'strong';
}

// Button animation states
export interface ButtonAnimationState {
  isHovered: boolean;
  isPressed: boolean;
  isLoading: boolean;
  isDisabled: boolean;
  animationType: 'none' | 'hover' | 'press' | 'loading' | 'success' | 'error';
}

// Popup animation states
export interface PopupAnimationState {
  isVisible: boolean;
  transitionState: TransitionState;
  activeTab: string;
  tabTransitionState: TransitionState;
  hasUnsavedChanges: boolean;
}

// Form detection animation states
export interface FormDetectionAnimationState {
  isDetecting: boolean;
  formsFound: number;
  detectionProgress: number; // 0-100
  showIndicator: boolean;
  indicatorPosition?: { x: number; y: number };
}

// Animation preferences
export interface AnimationPreferences {
  enableAnimations: boolean;
  respectReducedMotion: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast';
  enableSoundEffects: boolean;
  enableHapticFeedback: boolean;
}

// Animation event types
export type AnimationEvent = 
  | { type: 'ANIMATION_START'; payload: { animationId: string; config: any } }
  | { type: 'ANIMATION_END'; payload: { animationId: string; success: boolean } }
  | { type: 'ANIMATION_CANCEL'; payload: { animationId: string } }
  | { type: 'FIELD_HIGHLIGHT_START'; payload: { fieldId: string; selector: string } }
  | { type: 'FIELD_HIGHLIGHT_END'; payload: { fieldId: string } }
  | { type: 'AUTOFILL_PROGRESS'; payload: { progress: number; currentField: string } }
  | { type: 'FORM_DETECTION_START' }
  | { type: 'FORM_DETECTION_END'; payload: { formsFound: number } }
  | { type: 'POPUP_TRANSITION'; payload: { from: string; to: string } }
  | { type: 'BUTTON_INTERACTION'; payload: { buttonId: string; interaction: 'hover' | 'press' | 'release' } };

// Animation manager state
export interface AnimationManagerState {
  activeAnimations: Map<string, AnimationState>;
  queuedAnimations: AnimationEvent[];
  preferences: AnimationPreferences;
  isReducedMotion: boolean;
  globalAnimationState: 'enabled' | 'disabled' | 'reduced';
}

// Animation timing functions
export interface AnimationTiming {
  duration: number;
  delay: number;
  easing: string;
  iterations: number | 'infinite';
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  fillMode: 'none' | 'forwards' | 'backwards' | 'both';
}

// Keyframe animation definition
export interface KeyframeAnimation {
  id: string;
  name: string;
  keyframes: Keyframe[];
  timing: AnimationTiming;
  target?: string; // CSS selector
}

export interface Keyframe {
  offset: number; // 0-1
  properties: Record<string, string | number>;
  easing?: string;
}