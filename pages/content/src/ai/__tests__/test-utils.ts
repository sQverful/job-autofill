/**
 * Test utilities for HTML Extractor tests
 */

/**
 * Creates a mock form element with specified fields
 */
export function createMockForm(fields: Array<{
  type: string;
  name: string;
  attributes?: Record<string, string>;
}>): HTMLFormElement {
  const form = document.createElement('form');
  
  fields.forEach(field => {
    const input = document.createElement('input');
    input.type = field.type;
    input.name = field.name;
    
    if (field.attributes) {
      Object.entries(field.attributes).forEach(([key, value]) => {
        input.setAttribute(key, value);
      });
    }
    
    form.appendChild(input);
  });
  
  return form;
}

/**
 * Creates a mock container with form content
 */
export function createMockContainer(innerHTML: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = innerHTML;
  document.body.appendChild(container);
  return container;
}

/**
 * Cleans up mock container
 */
export function cleanupMockContainer(container: HTMLElement): void {
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

/**
 * Sample form HTML templates for testing
 */
export const SAMPLE_FORMS = {
  simple: `
    <form>
      <input type="text" name="firstName" />
      <input type="email" name="email" />
      <button type="submit">Submit</button>
    </form>
  `,
  
  complex: `
    <form class="job-application">
      <fieldset>
        <legend>Personal Information</legend>
        <input type="text" name="firstName" required />
        <input type="text" name="lastName" required />
        <input type="email" name="email" required />
        <input type="tel" name="phone" />
      </fieldset>
      
      <fieldset>
        <legend>Experience</legend>
        <input type="file" name="resume" accept=".pdf" />
        <textarea name="coverLetter" rows="5"></textarea>
        <select name="experience">
          <option value="0-1">0-1 years</option>
          <option value="2-5">2-5 years</option>
          <option value="5+">5+ years</option>
        </select>
      </fieldset>
      
      <div class="form-actions">
        <input type="checkbox" name="terms" required />
        <button type="submit">Submit Application</button>
      </div>
    </form>
  `,
  
  multiStep: `
    <div class="wizard">
      <div class="progress">
        <div class="step active">1</div>
        <div class="step">2</div>
        <div class="step">3</div>
      </div>
      
      <form>
        <div class="step-content" data-step="1">
          <input type="text" name="firstName" />
          <input type="text" name="lastName" />
        </div>
        
        <div class="step-content" data-step="2" style="display: none;">
          <input type="email" name="email" />
          <input type="tel" name="phone" />
        </div>
        
        <div class="step-content" data-step="3" style="display: none;">
          <input type="file" name="resume" />
          <textarea name="comments"></textarea>
        </div>
        
        <div class="navigation">
          <button type="button" id="prev">Previous</button>
          <button type="button" id="next">Next</button>
          <button type="submit" id="submit" style="display: none;">Submit</button>
        </div>
      </form>
    </div>
  `,
  
  withMalicious: `
    <form>
      <input type="text" name="safe" />
      <script>alert('xss')</script>
      <iframe src="evil.com"></iframe>
      <input type="text" onclick="malicious()" name="unsafe" />
      <object data="bad.swf"></object>
      <input type="email" name="email" />
    </form>
  `
};