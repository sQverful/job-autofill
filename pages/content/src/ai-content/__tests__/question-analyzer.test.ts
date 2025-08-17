/**
 * Tests for QuestionAnalyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QuestionAnalyzer } from '../question-analyzer.js';

describe('QuestionAnalyzer', () => {
  let analyzer: QuestionAnalyzer;

  beforeEach(() => {
    analyzer = new QuestionAnalyzer();
  });

  describe('analyzeQuestion', () => {
    it('should identify behavioral questions', () => {
      const question = 'Tell me about a time when you faced a difficult challenge at work';
      const analysis = analyzer.analyzeQuestion(question);

      expect(analysis.type).toBe('behavioral');
      expect(analysis.category).toBe('challenges');
      expect(analysis.intent).toBe('evaluate_skills');
      expect(analysis.expectedLength).toBe('long');
    });

    it('should identify motivational questions', () => {
      const question = 'Why are you interested in this role?';
      const analysis = analyzer.analyzeQuestion(question);

      expect(analysis.type).toBe('motivational');
      expect(analysis.category).toBe('why_interested');
      expect(analysis.intent).toBe('understand_motivation');
    });

    it('should identify skills questions', () => {
      const question = 'What are your strengths and how would you apply them in this role?';
      const analysis = analyzer.analyzeQuestion(question);

      expect(analysis.type).toBe('skills');
      expect(analysis.confidence).toBeGreaterThan(0.5);
    });

    it('should identify experience questions', () => {
      const question = 'Describe your experience with project management';
      const analysis = analyzer.analyzeQuestion(question);

      expect(analysis.type).toBe('experience');
      expect(analysis.keywords).toContain('experience');
      expect(analysis.keywords).toContain('project');
      expect(analysis.keywords).toContain('management');
    });

    it('should assess question complexity', () => {
      const simpleQuestion = 'Why do you want this job?';
      const complexQuestion = 'Describe a situation where you had to lead a cross-functional team through a major organizational change while managing competing priorities and stakeholder expectations';

      const simpleAnalysis = analyzer.analyzeQuestion(simpleQuestion);
      const complexAnalysis = analyzer.analyzeQuestion(complexQuestion);

      expect(simpleAnalysis.complexity).toBe('simple');
      expect(complexAnalysis.complexity).toBe('complex');
    });

    it('should determine expected response length', () => {
      const shortQuestion = 'Briefly summarize your experience';
      const longQuestion = 'Tell me about a time when you had to solve a complex problem';

      const shortAnalysis = analyzer.analyzeQuestion(shortQuestion);
      const longAnalysis = analyzer.analyzeQuestion(longQuestion);

      expect(shortAnalysis.expectedLength).toBe('short');
      expect(longAnalysis.expectedLength).toBe('long');
    });
  });

  describe('getContentTypeForQuestion', () => {
    it('should return correct content type for different question categories', () => {
      const whyInterestedAnalysis = { category: 'why_interested' } as any;
      const whyQualifiedAnalysis = { category: 'why_qualified' } as any;
      const experienceAnalysis = { category: 'experience_examples' } as any;

      expect(analyzer.getContentTypeForQuestion(whyInterestedAnalysis)).toBe('why_interested');
      expect(analyzer.getContentTypeForQuestion(whyQualifiedAnalysis)).toBe('why_qualified');
      expect(analyzer.getContentTypeForQuestion(experienceAnalysis)).toBe('question_response');
    });
  });

  describe('generateResponseGuidelines', () => {
    it('should provide STAR method guidance for behavioral questions', () => {
      const behavioralAnalysis = {
        type: 'behavioral',
        category: 'problem_solving',
        intent: 'evaluate_skills',
        expectedLength: 'long'
      } as any;

      const guidelines = analyzer.generateResponseGuidelines(behavioralAnalysis);

      expect(guidelines.structure).toContain('Start with a brief context');
      expect(guidelines.keyPoints).toContain('Use the STAR method (Situation, Task, Action, Result)');
      expect(guidelines.length).toBe('long');
    });

    it('should provide motivation-specific guidance for motivational questions', () => {
      const motivationalAnalysis = {
        type: 'motivational',
        category: 'why_interested',
        intent: 'understand_motivation',
        expectedLength: 'medium'
      } as any;

      const guidelines = analyzer.generateResponseGuidelines(motivationalAnalysis);

      expect(guidelines.structure).toContain('Express genuine interest');
      expect(guidelines.keyPoints).toContain('Be authentic and specific');
      expect(guidelines.examples.some(ex => ex.includes('particularly drawn'))).toBe(true);
    });

    it('should provide skills-specific guidance for skills questions', () => {
      const skillsAnalysis = {
        type: 'skills',
        category: 'general',
        intent: 'evaluate_skills',
        expectedLength: 'medium'
      } as any;

      const guidelines = analyzer.generateResponseGuidelines(skillsAnalysis);

      expect(guidelines.structure).toContain('State your relevant skills clearly');
      expect(guidelines.keyPoints).toContain('Match skills to job requirements');
    });
  });

  describe('edge cases', () => {
    it('should handle empty questions gracefully', () => {
      const analysis = analyzer.analyzeQuestion('');

      expect(analysis.type).toBe('open_ended');
      expect(analysis.confidence).toBeLessThan(0.7);
    });

    it('should handle very long questions', () => {
      const longQuestion = 'This is a very long question that goes on and on and includes many different parts and asks about multiple things including your experience and your skills and your motivation and your background and what you would do in various situations and how you handle challenges and what your career goals are and why you want to work here';
      
      const analysis = analyzer.analyzeQuestion(longQuestion);

      expect(analysis.complexity).toBe('complex');
      expect(analysis.keywords.length).toBeGreaterThan(0);
    });

    it('should handle questions with mixed types', () => {
      const mixedQuestion = 'Why are you interested in this role and can you give me an example of a time when you demonstrated leadership?';
      
      const analysis = analyzer.analyzeQuestion(mixedQuestion);

      expect(analysis.complexity).toBe('complex');
      expect(analysis.confidence).toBeGreaterThan(0.5);
    });
  });
});