document.getElementById('scanButton').addEventListener('click', () => {
  browser.tabs.executeScript({
    code: `
      (function() {
        const inputs = document.querySelectorAll('input');
        const inputData = [];
        
        inputs.forEach((input, index) => {
          inputData.push({
            index: index + 1,
            id: input.id || '',
            type: input.type || 'text',
            placeholder: input.placeholder || ''
          });
        });
        
        return inputData;
      })();
    `
  }).then(results => {
    displayResults(results[0]);
  }).catch(err => {
    document.getElementById('results').innerHTML = 
      '<div style="color: red;">Error: ' + err.message + '</div>';
  });
});

function displayResults(inputs) {
  const resultsDiv = document.getElementById('results');
  const countDiv = document.getElementById('count');
  
  if (!inputs || inputs.length === 0) {
    resultsDiv.innerHTML = '<div class="empty">No input elements found on this page.</div>';
    countDiv.textContent = '';
    return;
  }
  
  countDiv.textContent = `Found ${inputs.length} input element(s)`;
  
  let html = '';
  inputs.forEach(input => {
    html += `
      <div class="input-item">
        <div><span class="label">Input #:</span><span class="value">${input.index}</span></div>
        <div><span class="label">ID:</span><span class="value ${!input.id ? 'empty' : ''}">${input.id || '(none)'}</span></div>
        <div><span class="label">Type:</span><span class="value">${input.type}</span></div>
        <div><span class="label">Placeholder:</span><span class="value ${!input.placeholder ? 'empty' : ''}">${input.placeholder || '(none)'}</span></div>
      </div>
    `;
  });
  
  resultsDiv.innerHTML = html;
}