/**
 * Integration tests for HTML Extractor with real-world form scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HTMLExtractor } from '../html-extractor';

describe('HTMLExtractor Integration Tests', () => {
  let extractor: HTMLExtractor;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    extractor = new HTMLExtractor();
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    if (mockContainer.parentNode) {
      mockContainer.parentNode.removeChild(mockContainer);
    }
  });

  describe('Real-world job application forms', () => {
    it('should handle LinkedIn-style job application form', async () => {
      mockContainer.innerHTML = `
        <div class="jobs-apply-form">
          <form>
            <fieldset>
              <legend>Personal Information</legend>
              <div class="form-group">
                <label for="firstName">First Name *</label>
                <input type="text" id="firstName" name="firstName" required />
              </div>
              <div class="form-group">
                <label for="lastName">Last Name *</label>
                <input type="text" id="lastName" name="lastName" required />
              </div>
              <div class="form-group">
                <label for="email">Email *</label>
                <input type="email" id="email" name="email" required />
              </div>
              <div class="form-group">
                <label for="phone">Phone</label>
                <input type="tel" id="phone" name="phone" />
              </div>
            </fieldset>
            
            <fieldset>
              <legend>Experience</legend>
              <div class="form-group">
                <label for="resume">Resume *</label>
                <input type="file" id="resume" name="resume" accept=".pdf,.doc,.docx" required />
              </div>
              <div class="form-group">
                <label for="coverLetter">Cover Letter</label>
                <textarea id="coverLetter" name="coverLetter" rows="5"></textarea>
              </div>
            </fieldset>
            
            <div class="form-actions">
              <button type="submit" class="btn-primary">Submit Application</button>
            </div>
          </form>
        </div>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.formCount).toBe(1);
      expect(result.metadata.fieldCount).toBe(6);
      expect(result.metadata.hasFileUploads).toBe(true);
      expect(result.metadata.fieldTypes.text).toBe(2);
      expect(result.metadata.fieldTypes.email).toBe(1);
      expect(result.metadata.fieldTypes.tel).toBe(1);
      expect(result.metadata.fieldTypes.file).toBe(1);
      expect(result.metadata.fieldTypes.textarea).toBe(1);
      expect(result.metadata.estimatedComplexity).toBe('medium');
    });

    it('should handle Greenhouse-style multi-step form', async () => {
      mockContainer.innerHTML = `
        <div class="application-form">
          <div class="progress-indicator">
            <div class="step active" data-step="1">Personal Info</div>
            <div class="step" data-step="2">Experience</div>
            <div class="step" data-step="3">Questions</div>
          </div>
          
          <form id="application-form">
            <div class="step-content" data-step="1">
              <h3>Personal Information</h3>
              <input type="text" name="first_name" placeholder="First Name" required />
              <input type="text" name="last_name" placeholder="Last Name" required />
              <input type="email" name="email" placeholder="Email Address" required />
              <input type="tel" name="phone" placeholder="Phone Number" />
              
              <div class="location-fields">
                <select name="country" required>
                  <option value="">Select Country</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="UK">United Kingdom</option>
                </select>
                <input type="text" name="city" placeholder="City" />
                <input type="text" name="state" placeholder="State/Province" />
              </div>
            </div>
            
            <div class="step-content" data-step="2" style="display: none;">
              <h3>Work Experience</h3>
              <input type="file" name="resume" accept=".pdf,.doc,.docx" required />
              <input type="file" name="cover_letter" accept=".pdf,.doc,.docx" />
              
              <div class="experience-section">
                <h4>Current/Most Recent Position</h4>
                <input type="text" name="current_title" placeholder="Job Title" />
                <input type="text" name="current_company" placeholder="Company" />
                <input type="date" name="start_date" />
                <input type="date" name="end_date" />
                <textarea name="job_description" placeholder="Job Description" rows="4"></textarea>
              </div>
            </div>
            
            <div class="form-navigation">
              <button type="button" class="btn-secondary" id="prev-step">Previous</button>
              <button type="button" class="btn-primary" id="next-step">Next</button>
              <button type="submit" class="btn-primary" id="submit-btn" style="display: none;">Submit</button>
            </div>
          </form>
        </div>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.formCount).toBe(1);
      expect(result.metadata.hasMultiStep).toBe(true);
      expect(result.metadata.hasFileUploads).toBe(true);
      expect(result.metadata.fieldCount).toBe(14);
      expect(result.metadata.estimatedComplexity).toBe('high');
      
      // Should contain step indicators
      expect(result.html).toContain('data-step');
    });

    it('should handle Workday-style complex form with dynamic fields', async () => {
      mockContainer.innerHTML = `
        <div class="wd-form">
          <form>
            <section class="personal-info">
              <div class="field-group">
                <label>Name</label>
                <input type="text" name="firstName" data-automation-id="firstName" />
                <input type="text" name="middleName" data-automation-id="middleName" />
                <input type="text" name="lastName" data-automation-id="lastName" />
              </div>
              
              <div class="field-group">
                <label>Contact Information</label>
                <input type="email" name="email" data-automation-id="email" />
                <input type="tel" name="homePhone" data-automation-id="homePhone" />
                <input type="tel" name="mobilePhone" data-automation-id="mobilePhone" />
              </div>
              
              <div class="address-section">
                <input type="text" name="address1" placeholder="Address Line 1" />
                <input type="text" name="address2" placeholder="Address Line 2" />
                <input type="text" name="city" placeholder="City" />
                <select name="state">
                  <option value="">Select State</option>
                  <option value="CA">California</option>
                  <option value="NY">New York</option>
                </select>
                <input type="text" name="zipCode" placeholder="ZIP Code" />
              </div>
            </section>
            
            <section class="work-authorization">
              <h3>Work Authorization</h3>
              <div class="radio-group">
                <input type="radio" name="workAuth" value="citizen" id="citizen" />
                <label for="citizen">US Citizen</label>
                <input type="radio" name="workAuth" value="permanent" id="permanent" />
                <label for="permanent">Permanent Resident</label>
                <input type="radio" name="workAuth" value="visa" id="visa" />
                <label for="visa">Visa Holder</label>
              </div>
              
              <div class="visa-details" style="display: none;">
                <select name="visaType">
                  <option value="">Select Visa Type</option>
                  <option value="H1B">H1B</option>
                  <option value="F1">F1 OPT</option>
                  <option value="L1">L1</option>
                </select>
                <input type="date" name="visaExpiry" />
              </div>
            </section>
            
            <section class="documents">
              <h3>Required Documents</h3>
              <div class="file-uploads">
                <div class="upload-field">
                  <label>Resume *</label>
                  <input type="file" name="resume" accept=".pdf,.doc,.docx" required />
                </div>
                <div class="upload-field">
                  <label>Cover Letter</label>
                  <input type="file" name="coverLetter" accept=".pdf,.doc,.docx" />
                </div>
                <div class="upload-field">
                  <label>Portfolio/Work Samples</label>
                  <input type="file" name="portfolio" accept=".pdf,.zip" multiple />
                </div>
              </div>
            </section>
            
            <section class="questionnaire">
              <h3>Additional Questions</h3>
              <div class="question">
                <label>Years of experience in relevant field</label>
                <select name="experience">
                  <option value="">Select</option>
                  <option value="0-1">0-1 years</option>
                  <option value="2-5">2-5 years</option>
                  <option value="5+">5+ years</option>
                </select>
              </div>
              
              <div class="question">
                <label>Salary expectations</label>
                <input type="number" name="salaryMin" placeholder="Minimum" />
                <input type="number" name="salaryMax" placeholder="Maximum" />
              </div>
              
              <div class="question">
                <label>Additional comments</label>
                <textarea name="comments" rows="4"></textarea>
              </div>
            </section>
            
            <div class="form-actions">
              <input type="checkbox" name="terms" required />
              <label for="terms">I agree to the terms and conditions</label>
              <button type="submit">Submit Application</button>
            </div>
          </form>
        </div>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.formCount).toBe(1);
      expect(result.metadata.fieldCount).toBe(24);
      expect(result.metadata.hasFileUploads).toBe(true);
      expect(result.metadata.estimatedComplexity).toBe('high');
      
      // Check field type distribution
      expect(result.metadata.fieldTypes.text).toBeGreaterThan(5);
      expect(result.metadata.fieldTypes.select).toBeGreaterThan(2);
      expect(result.metadata.fieldTypes.radio).toBe(3);
      expect(result.metadata.fieldTypes.file).toBe(3);
      expect(result.metadata.fieldTypes.checkbox).toBe(1);
    });
  });

  describe('Edge cases with real-world complexity', () => {
    it('should handle forms with React-style dynamic content', async () => {
      mockContainer.innerHTML = `
        <div id="react-form-root">
          <div data-reactroot="">
            <form>
              <div class="form-section" data-testid="personal-info">
                <input type="text" name="firstName" data-cy="first-name" />
                <input type="text" name="lastName" data-cy="last-name" />
              </div>
              
              <div class="dynamic-fields" data-component="DynamicFieldGroup">
                <div data-field-id="1">
                  <input type="text" name="skill[0]" placeholder="Skill 1" />
                  <select name="proficiency[0]">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div data-field-id="2">
                  <input type="text" name="skill[1]" placeholder="Skill 2" />
                  <select name="proficiency[1]">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
              </div>
              
              <button type="button" data-action="add-skill">Add Another Skill</button>
              <button type="submit">Submit</button>
            </form>
          </div>
        </div>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.fieldCount).toBe(6);
      expect(result.html).toContain('skill[0]');
      expect(result.html).toContain('proficiency[1]');
      
      // Should remove React-specific attributes by default
      expect(result.html).not.toContain('data-reactroot');
      expect(result.html).not.toContain('data-testid');
      expect(result.html).not.toContain('data-cy');
    });

    it('should handle forms with embedded iframes and widgets', async () => {
      mockContainer.innerHTML = `
        <form class="job-application">
          <div class="basic-info">
            <input type="text" name="name" />
            <input type="email" name="email" />
          </div>
          
          <!-- This should be removed -->
          <iframe src="https://evil.com/tracker" style="display:none;"></iframe>
          
          <div class="captcha-section">
            <!-- This should be removed -->
            <script src="https://www.google.com/recaptcha/api.js"></script>
            <div class="g-recaptcha" data-sitekey="fake-key"></div>
          </div>
          
          <div class="file-upload">
            <input type="file" name="resume" />
          </div>
          
          <!-- This should be removed -->
          <object data="malicious.swf" type="application/x-shockwave-flash"></object>
          
          <button type="submit">Submit</button>
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.fieldCount).toBe(3);
      expect(result.html).not.toContain('<iframe');
      expect(result.html).not.toContain('<script');
      expect(result.html).not.toContain('<object');
      expect(result.html).toContain('input');
      expect(result.html).toContain('button');
    });

    it('should handle forms with complex validation attributes', async () => {
      mockContainer.innerHTML = `
        <form novalidate>
          <input 
            type="email" 
            name="email" 
            required 
            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$"
            title="Please enter a valid email address"
            data-validation="email"
            data-error-message="Invalid email format"
          />
          
          <input 
            type="password" 
            name="password" 
            required 
            minlength="8" 
            maxlength="128"
            pattern="(?=.*\\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
            title="Password must contain at least 8 characters with uppercase, lowercase and numbers"
          />
          
          <input 
            type="tel" 
            name="phone" 
            pattern="\\([0-9]{3}\\) [0-9]{3}-[0-9]{4}"
            placeholder="(123) 456-7890"
            data-mask="(999) 999-9999"
          />
          
          <input 
            type="number" 
            name="salary" 
            min="0" 
            max="1000000" 
            step="1000"
            data-currency="USD"
          />
          
          <button type="submit">Submit</button>
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.fieldCount).toBe(4);
      
      // Should preserve validation attributes
      expect(result.html).toContain('required');
      expect(result.html).toContain('pattern');
      expect(result.html).toContain('minlength');
      expect(result.html).toContain('maxlength');
      expect(result.html).toContain('min=');
      expect(result.html).toContain('max=');
      
      // Should remove data attributes by default
      expect(result.html).not.toContain('data-validation');
      expect(result.html).not.toContain('data-error-message');
      expect(result.html).not.toContain('data-mask');
      expect(result.html).not.toContain('data-currency');
    });
  });

  describe('Performance with large forms', () => {
    it('should handle forms with many fields efficiently', async () => {
      // Generate a large form with 100 fields
      let formHTML = '<form>';
      for (let i = 0; i < 100; i++) {
        formHTML += `
          <div class="field-group-${i}">
            <label for="field${i}">Field ${i}</label>
            <input type="text" id="field${i}" name="field${i}" />
          </div>
        `;
      }
      formHTML += '</form>';
      
      mockContainer.innerHTML = formHTML;

      const startTime = Date.now();
      const result = await extractor.extractFormHTML(mockContainer);
      const endTime = Date.now();

      expect(result.metadata.fieldCount).toBe(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.hash).toBeDefined();
    });

    it('should handle deeply nested form structures', async () => {
      // Create deeply nested structure (10 levels deep)
      let nestedHTML = '<form>';
      for (let i = 0; i < 10; i++) {
        nestedHTML += `<div class="level-${i}">`;
      }
      nestedHTML += '<input type="text" name="deepField" />';
      for (let i = 0; i < 10; i++) {
        nestedHTML += '</div>';
      }
      nestedHTML += '</form>';
      
      mockContainer.innerHTML = nestedHTML;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.fieldCount).toBe(1);
      expect(result.html).toContain('deepField');
    });
  });
});