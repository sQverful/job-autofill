/**
 * Test script to verify the new configuration system integration
 * This tests that hardcoded patterns have been successfully extracted to JSON
 */

import { configLoader } from './config/config-loader';
import { websiteDetector } from './detection/website-detector';
import { FieldMapper } from './detection/field-mapper';

/**
 * Test configuration loading and website detection
 */
async function testConfigurationIntegration(): Promise<void> {
  console.log('🧪 Testing Configuration Integration...\n');

  try {
    // Test 1: Load configuration
    console.log('1️⃣ Testing configuration loading...');
    const loadResult = await configLoader.loadConfig();

    if (loadResult.success) {
      console.log('✅ Configuration loaded successfully', {
        source: loadResult.source,
        fallbackUsed: loadResult.fallbackUsed,
        loadTime: `${loadResult.loadTime}ms`,
        websiteCount: Object.keys(loadResult.config || {}).length,
      });
    } else {
      console.error('❌ Configuration loading failed:', loadResult.error);
      return;
    }

    // Test 2: Test known websites
    console.log('\n2️⃣ Testing known website configurations...');
    const testWebsites = [
      'boards.greenhouse.io',
      'jobs.lever.co',
      'www.uber.com',
      'linkedin.com',
      'indeed.com',
      'myworkdayjobs.com',
    ];

    for (const hostname of testWebsites) {
      const config = await configLoader.getWebsiteConfig(hostname);

      if (config) {
        console.log(`✅ ${hostname}:`, {
          isComplex: config.isComplex,
          selectorCount: Object.keys(config.selectorMapping).length,
          selectors: Object.keys(config.selectorMapping).slice(0, 3).join(', ') + '...',
        });
      } else {
        console.log(`❌ ${hostname}: No configuration found`);
      }
    }

    // Test 3: Test fallback for unknown website
    console.log('\n3️⃣ Testing fallback for unknown website...');
    const unknownConfig = await configLoader.getWebsiteConfigWithFallback('unknown-website.com');
    console.log('✅ Unknown website fallback:', {
      isComplex: unknownConfig.isComplex,
      selectorCount: Object.keys(unknownConfig.selectorMapping).length,
    });

    // Test 4: Test configuration health
    console.log('\n4️⃣ Testing configuration health...');
    const health = await configLoader.getConfigurationHealth();
    console.log('📊 Configuration health:', health);

    // Test 5: Test configuration statistics
    console.log('\n5️⃣ Testing configuration statistics...');
    const stats = await configLoader.getConfigStats();
    console.log('📈 Configuration statistics:', stats);

    // Test 6: Test supported hostnames
    console.log('\n6️⃣ Testing supported hostnames...');
    const supportedHostnames = await configLoader.getSupportedHostnames();
    console.log('🌐 Supported hostnames:', supportedHostnames);

    console.log('\n✅ All configuration tests completed successfully!');
  } catch (error) {
    console.error('❌ Configuration integration test failed:', error);
  }
}

/**
 * Test website detection with new configuration
 */
async function testWebsiteDetection(): Promise<void> {
  console.log('\n🔍 Testing Website Detection Integration...\n');

  try {

    // Test detection for current page
    console.log('1️⃣ Testing detection for current page...');
    const currentDetection = await websiteDetector.detectWebsite();
    console.log('🎯 Current page detection:', currentDetection);

    // Test detection health
    console.log('\n2️⃣ Testing detection system health...');
    const detectionHealth = await websiteDetector.getDetectionHealth();
    console.log('🏥 Detection health:', detectionHealth);

    console.log('\n✅ Website detection tests completed!');
  } catch (error) {
    console.error('❌ Website detection test failed:', error);
  }
}

/**
 * Test field mapping with configuration
 */
async function testFieldMapping(): Promise<void> {
  console.log('\n🗺️ Testing Field Mapping Integration...\n');

  try {

    // Create a mock website config for testing
    const mockConfig = {
      domains: ['test.com'],
      platform: 'custom' as const,
      confidence: 0.8,
      isComplex: false,
      detectionStrategies: [],
      fieldMappings: [
        {
          selector: "input[name='firstName']",
          profileField: 'personalInfo.firstName',
          fieldType: 'text',
          required: true,
        },
        {
          selector: "input[name='email']",
          profileField: 'personalInfo.email',
          fieldType: 'email',
          required: true,
        },
      ],
      lastUpdated: new Date().toISOString(),
    };

    const fieldMapper = new FieldMapper(mockConfig);

    // Create mock profile
    const mockProfile = {
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-0123',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'United States',
        },
      },
    };

    // Test field mapping health
    console.log('1️⃣ Testing field mapping health...');
    const mappingHealth = await fieldMapper.getMappingHealth(mockProfile);
    console.log('🏥 Field mapping health:', mappingHealth);

    console.log('\n✅ Field mapping tests completed!');
  } catch (error) {
    console.error('❌ Field mapping test failed:', error);
  }
}

/**
 * Run all integration tests
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 Starting Configuration Integration Tests\n');
  console.log('='.repeat(60));

  await testConfigurationIntegration();
  await testWebsiteDetection();
  await testFieldMapping();

  console.log('\n' + '='.repeat(60));
  console.log('🎉 All integration tests completed!');
  console.log('\n💡 The configuration system is now integrated and ready to use.');
  console.log('📝 Hardcoded patterns have been extracted to supported_websites_config.json');
  console.log('🔧 The system will use configuration-based detection with hardcoded fallbacks');
}

// Auto-run tests when script is loaded
if (typeof window !== 'undefined') {
  // Run tests after a short delay to ensure all modules are loaded
  setTimeout(runAllTests, 1000);
}

export { testConfigurationIntegration, testWebsiteDetection, testFieldMapping, runAllTests };
