// Default field mappings
const DEFAULT_MAPPINGS = {
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

let FIELD_MAPPINGS = { ...DEFAULT_MAPPINGS };

const fieldCategorizer = {
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

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    if (tabName === 'settings') {
      loadSettingsUI();
    }
  });
});

// Load saved mappings on startup
chrome.storage.local.get('fieldMappings').then(data => {
  if (data.fieldMappings) {
    FIELD_MAPPINGS = data.fieldMappings;
  }
});

// Scan button handler
document.getElementById('scanButton').addEventListener('click', async () => {
  const button = document.getElementById('scanButton');
  button.disabled = true;
  button.textContent = '🔄 Scanning...';
  
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const inputs = document.querySelectorAll('input');
        const inputData = [];
        
        inputs.forEach((input, index) => {
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
      }
    });
    
    const inputs = results[0].result;
    
    if (!inputs || inputs.length === 0) {
      displayResults(inputs, {});
      document.getElementById('fillButton').style.display = 'none';
      document.getElementById('stats').style.display = 'none';
      return;
    }
    
    const categories = {};
    inputs.forEach(field => {
      const category = fieldCategorizer.categorize(field);
      if (category) {
        categories[field.fieldId] = category;
      }
    });
    
    scannedInputs = inputs;
    detectedCategories = categories;
    
    const fillableCount = Object.keys(categories).filter(
      fieldId => FIELD_MAPPINGS[categories[fieldId]]
    ).length;
    
    if (fillableCount > 0) {
      document.getElementById('fillButton').style.display = 'block';
    } else {
      document.getElementById('fillButton').style.display = 'none';
    }
    
    displayResults(inputs, categories);
    displayStats(inputs.length, Object.keys(categories).length, fillableCount);
    
  } catch (err) {
    document.getElementById('results').innerHTML = 
      `<div class="empty-state">
        <p style="color: #ff4757;">❌ Error: ${err.message}</p>
      </div>`;
  } finally {
    button.disabled = false;
    button.textContent = '🔍 Scan Page';
  }
});

// Fill button handler
document.getElementById('fillButton').addEventListener('click', async () => {
  const button = document.getElementById('fillButton');
  button.disabled = true;
  button.textContent = '⏳ Filling...';
  
  try {
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
    
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (fillData) => {
        let filledCount = 0;
        
        for (const [fieldId, data] of Object.entries(fillData)) {
          try {
            const input = document.querySelector(data.selector);
            if (input && !input.disabled && !input.readOnly) {
              input.value = data.value;
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
      },
      args: [fillData]
    });
    
    button.textContent = '✅ Filled Successfully';
    setTimeout(() => {
      button.textContent = '✨ Fill Form';
      button.disabled = false;
    }, 2000);
    
  } catch (err) {
    button.textContent = '❌ Fill Failed';
    console.error('Fill error:', err);
    setTimeout(() => {
      button.textContent = '✨ Fill Form';
      button.disabled = false;
    }, 2000);
  }
});

function displayStats(total, categorized, fillable) {
  document.getElementById('stats').style.display = 'flex';
  document.getElementById('totalFields').textContent = total;
  document.getElementById('categorizedFields').textContent = categorized;
  document.getElementById('fillableFields').textContent = fillable;
}

function displayResults(inputs, categories) {
  const resultsDiv = document.getElementById('results');
  
  if (!inputs || inputs.length === 0) {
    resultsDiv.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
        </svg>
        <p>No input fields found on this page</p>
        <p style="font-size: 12px; color: #ccc;">Navigate to a form and click "Scan Page"</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  inputs.forEach(input => {
    const category = categories[input.fieldId];
    const isSensitive = fieldCategorizer.isSensitiveField(input);
    const fillValue = category ? FIELD_MAPPINGS[category] || '' : '';
    
    html += `
      <div class="input-item ${isSensitive ? 'sensitive' : ''}">
        <div class="field-header">
          <span class="field-number">#${input.index}</span>
          ${category ? `<span class="category-badge">${category.replace(/_/g, ' ')}</span>` : ''}
        </div>
        <div class="field-info">
          ${input.id ? `<div class="field-row"><span class="label">ID:</span><span class="value">${input.id}</span></div>` : ''}
          ${input.name ? `<div class="field-row"><span class="label">Name:</span><span class="value">${input.name}</span></div>` : ''}
          <div class="field-row"><span class="label">Type:</span><span class="value">${input.type}</span></div>
          ${input.placeholder ? `<div class="field-row"><span class="label">Placeholder:</span><span class="value">${input.placeholder}</span></div>` : ''}
          ${input.label ? `<div class="field-row"><span class="label">Label:</span><span class="value">${input.label}</span></div>` : ''}
          ${fillValue ? `<div class="field-row"><span class="label">Fill Value:</span><span class="value fill-value">${fillValue}</span></div>` : ''}
        </div>
        ${isSensitive ? `<div class="warning">⚠️ Sensitive field - will not be auto-filled</div>` : ''}
      </div>
    `;
  });
  
  resultsDiv.innerHTML = html;
}

// Settings UI
function loadSettingsUI() {
  const mappingList = document.getElementById('mappingList');
  mappingList.innerHTML = '';
  
  Object.entries(FIELD_MAPPINGS).forEach(([category, value]) => {
    addMappingRow(category, value);
  });
}

function addMappingRow(category = '', value = '') {
  const mappingList = document.getElementById('mappingList');
  const row = document.createElement('div');
  row.className = 'mapping-item';
  row.innerHTML = `
    <input type="text" class="category-input" placeholder="Category (e.g., email)" value="${category}">
    <input type="text" class="value-input" placeholder="Value to fill" value="${value}">
    <button class="delete-mapping" title="Delete">×</button>
  `;
  
  row.querySelector('.delete-mapping').addEventListener('click', () => {
    row.remove();
  });
  
  mappingList.appendChild(row);
}

document.getElementById('addMappingBtn').addEventListener('click', () => {
  addMappingRow();
});

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const mappingItems = document.querySelectorAll('.mapping-item');
  const newMappings = {};
  
  mappingItems.forEach(item => {
    const category = item.querySelector('.category-input').value.trim();
    const value = item.querySelector('.value-input').value.trim();
    
    if (category && value) {
      newMappings[category] = value;
    }
  });
  
  FIELD_MAPPINGS = newMappings;
  
  await chrome.storage.local.set({ fieldMappings: newMappings });
  
  const saveMessage = document.getElementById('saveMessage');
  saveMessage.innerHTML = '<div class="success-message">✅ Settings saved successfully!</div>';
  
  setTimeout(() => {
    saveMessage.innerHTML = '';
  }, 3000);
});