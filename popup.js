// Static field mappings - customize these values
const FIELD_MAPPINGS = {
  'email': 'your_email@example.com',
  'first_name': 'John',
  'last_name': 'Doe',
  'full_name': 'John Doe',
  'phone': '+1234567890',
  'address': '123 Main Street',
  'city': 'New York',
  'state': 'NY',
  'zip_code': '10001',
  'country': 'United States',
  'company_name': 'Tech Corp',
  'job_title': 'Software Engineer',
  'website': 'https://example.com',
  'linkedin_url': 'https://linkedin.com/in/johndoe',
  'github_url': 'https://github.com/johndoe'
};

const fieldCategorizer = {
  /**
   * Categorize field using pattern matching
   */
  categorize: (field) => {
    const patterns = {
      email: [/email/i, /e-mail/i],
      phone: [/phone/i, /mobile/i, /tel/i],
      first_name: [/first.*name/i, /fname/i, /given.*name/i],
      last_name: [/last.*name/i, /lname/i, /surname/i, /family.*name/i],
      full_name: [/^name$/i, /full.*name/i],
      address: [/address/i, /street/i],
      city: [/city/i, /town/i],
      state: [/state/i, /province/i, /region/i],
      zip_code: [/zip/i, /postal/i],
      country: [/country/i, /nation/i],
      company_name: [/company/i, /organization/i, /employer/i],
      job_title: [/title/i, /position/i, /role/i],
      website: [/website/i, /url/i, /link/i],
      linkedin_url: [/linkedin/i],
      github_url: [/github/i]
    };

    const searchText = `${field.name} ${field.id} ${field.label || ''} ${field.placeholder || ''}`;

    for (const [category, regexList] of Object.entries(patterns)) {
      if (regexList.some(regex => regex.test(searchText))) {
        return category;
      }
    }

    return null;
  },

  /**
   * Check if field is sensitive
   */
  isSensitiveField: (field) => {
    const sensitiveTypes = ['password', 'hidden'];
    const sensitiveKeywords = [
      'password', 'passwd', 'pwd',
      'credit', 'card', 'cvv', 'cvc',
      'ssn', 'social',
      'pin', 'security',
      'bank', 'account'
    ];

    if (sensitiveTypes.includes(field.type.toLowerCase())) {
      return true;
    }

    const fieldsToCheck = [
      field.name || '',
      field.id || '',
      field.label || '',
      field.placeholder || '',
      field.autocomplete || ''
    ].map(s => s.toLowerCase());

    return sensitiveKeywords.some(keyword =>
      fieldsToCheck.some(fieldText => fieldText.includes(keyword))
    );
  }
};

// Main popup logic
let scannedInputs = [];
let detectedCategories = {};

document.getElementById('scanButton').addEventListener('click', async () => {
  const button = document.getElementById('scanButton');
  button.disabled = true;
  button.textContent = 'Scanning...';
  
  try {
    const results = await browser.tabs.executeScript({
      code: `
        (function() {
          const inputs = document.querySelectorAll('input');
          const inputData = [];
          
          inputs.forEach((input, index) => {
            // Get label if exists
            let label = '';
            if (input.id) {
              const labelEl = document.querySelector('label[for="' + input.id + '"]');
              if (labelEl) label = labelEl.textContent.trim();
            }
            if (!label && input.labels && input.labels.length > 0) {
              label = input.labels[0].textContent.trim();
            }
            
            inputData.push({
              index: index + 1,
              fieldId: input.id || 'field_' + (index + 1),
              id: input.id || '',
              name: input.name || '',
              type: input.type || 'text',
              placeholder: input.placeholder || '',
              label: label,
              autocomplete: input.autocomplete || ''
            });
          });
          
          return inputData;
        })();
      `
    });
    
    const inputs = results[0];
    
    if (!inputs || inputs.length === 0) {
      displayResults(inputs, {});
      document.getElementById('fillButton').style.display = 'none';
      return;
    }
    
    // Categorize fields
    const categories = {};
    inputs.forEach(field => {
      const category = fieldCategorizer.categorize(field);
      if (category) {
        categories[field.fieldId] = category;
      }
    });
    
    // Store for filling later
    scannedInputs = inputs;
    detectedCategories = categories;
    
    // Show fill button if there are categorized fields
    const fillableCount = Object.keys(categories).filter(
      fieldId => FIELD_MAPPINGS[categories[fieldId]]
    ).length;
    
    if (fillableCount > 0) {
      document.getElementById('fillButton').style.display = 'block';
    } else {
      document.getElementById('fillButton').style.display = 'none';
    }
    
    displayResults(inputs, categories);
    
  } catch (err) {
    document.getElementById('results').innerHTML = 
      '<div style="color: red;">Error: ' + err.message + '</div>';
  } finally {
    button.disabled = false;
    button.textContent = 'Scan Page for Inputs';
  }
});

// Fill form button handler
document.getElementById('fillButton').addEventListener('click', async () => {
  const button = document.getElementById('fillButton');
  button.disabled = true;
  button.textContent = 'Filling...';
  
  try {
    // Prepare fill data
    const fillData = {};
    scannedInputs.forEach(field => {
      const category = detectedCategories[field.fieldId];
      if (category && FIELD_MAPPINGS[category] && !fieldCategorizer.isSensitiveField(field)) {
        fillData[field.fieldId] = {
          value: FIELD_MAPPINGS[category],
          selector: field.id ? `#${field.id}` : `input[name="${field.name}"]`
        };
      }
    });
    
    // Inject and execute fill script
    await browser.tabs.executeScript({
      code: `
        (function() {
          const fillData = ${JSON.stringify(fillData)};
          let filledCount = 0;
          
          for (const [fieldId, data] of Object.entries(fillData)) {
            try {
              const input = document.querySelector(data.selector);
              if (input && !input.disabled && !input.readOnly) {
                // Set value
                input.value = data.value;
                
                // Trigger events to ensure the page detects the change
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
                
                filledCount++;
              }
            } catch (e) {
              console.error('Error filling field:', fieldId, e);
            }
          }
          
          return filledCount;
        })();
      `
    });
    
    button.textContent = '✓ Form Filled Successfully';
    setTimeout(() => {
      button.textContent = 'Fill Form with Mapped Values';
      button.disabled = false;
    }, 2000);
    
  } catch (err) {
    button.textContent = '✗ Fill Failed';
    console.error('Fill error:', err);
    setTimeout(() => {
      button.textContent = 'Fill Form with Mapped Values';
      button.disabled = false;
    }, 2000);
  }
});

function displayResults(inputs, categories) {
  const resultsDiv = document.getElementById('results');
  const countDiv = document.getElementById('count');
  
  if (!inputs || inputs.length === 0) {
    resultsDiv.innerHTML = '<div class="empty">No input elements found on this page.</div>';
    countDiv.textContent = '';
    return;
  }
  
  const categorizedCount = Object.keys(categories).length;
  countDiv.textContent = `Found ${inputs.length} input element(s) | ${categorizedCount} categorized`;
  
  let html = '';
  inputs.forEach(input => {
    const category = categories[input.fieldId];
    const isSensitive = fieldCategorizer.isSensitiveField(input);
    const fillValue = category ? FIELD_MAPPINGS[category] || '' : '';
    
    html += `
      <div class="input-item" style="${isSensitive ? 'border-left: 3px solid #ff4444;' : ''}">
        <div><span class="label">Input #:</span><span class="value">${input.index}</span></div>
        <div><span class="label">ID:</span><span class="value ${!input.id ? 'empty' : ''}">${input.id || '(none)'}</span></div>
        <div><span class="label">Name:</span><span class="value ${!input.name ? 'empty' : ''}">${input.name || '(none)'}</span></div>
        <div><span class="label">Type:</span><span class="value">${input.type}</span></div>
        <div><span class="label">Placeholder:</span><span class="value ${!input.placeholder ? 'empty' : ''}">${input.placeholder || '(none)'}</span></div>
        ${input.label ? `<div><span class="label">Label:</span><span class="value">${input.label}</span></div>` : ''}
        ${category ? `<div><span class="label">Category:</span><span class="value" style="color: #00a400; font-weight: bold;">${category}</span></div>` : ''}
        ${fillValue ? `<div><span class="label">Fill Value:</span><span class="value" style="color: #0060df; font-weight: bold;">${fillValue}</span></div>` : ''}
        ${isSensitive ? `<div style="color: #ff4444; font-size: 11px; margin-top: 5px;">⚠️ Sensitive field (will not be auto-filled)</div>` : ''}
      </div>
    `;
  });
  
  resultsDiv.innerHTML = html;
}