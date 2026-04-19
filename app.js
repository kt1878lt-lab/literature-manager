// 全域變數
let supabase = null;
let literatureData = [];
let config = {
  anthropicKey: localStorage.getItem('anthropic_key') || '',
  supabaseUrl: localStorage.getItem('supabase_url') || '',
  supabaseKey: localStorage.getItem('supabase_key') || ''
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
  loadSettings();
  if (config.supabaseUrl && config.supabaseKey) {
    initSupabase();
    loadLiterature();
  }
});

function initializeApp() {
  // 設定導航
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      showPage(page);
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 設定子導航
  document.querySelectorAll('.sub-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sub = btn.dataset.sub;
      showSubPage(sub);
      document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 設定篩選按鈕
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      filterMethods(filter);
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function setupEventListeners() {
  // 搜尋功能
  document.getElementById('search-all')?.addEventListener('input', (e) => {
    filterLiterature(e.target.value);
  });

  document.getElementById('search-notes')?.addEventListener('input', (e) => {
    filterNotes(e.target.value);
  });

  // 上傳區域
  const uploadZone = document.getElementById('upload-zone');
  const pdfInput = document.getElementById('pdf-input');

  uploadZone?.addEventListener('click', () => pdfInput.click());

  uploadZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragging');
  });

  uploadZone?.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragging');
  });

  uploadZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      handlePDFUpload(file);
    }
  });

  pdfInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handlePDFUpload(file);
  });

  // 表單提交
  document.getElementById('add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveLiterature(new FormData(e.target));
    e.target.reset();
  });
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${pageId}`)?.classList.add('active');
}

function showSubPage(subId) {
  document.querySelectorAll('.sub-page').forEach(p => p.classList.remove('active'));
  document.getElementById(`sub-${subId}`)?.classList.add('active');
}

// Supabase 初始化
function initSupabase() {
  if (!config.supabaseUrl || !config.supabaseKey) return;
  
  supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
}

// 載入文獻
async function loadLiterature() {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('literature')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('載入資料錯誤:', error);
    return;
  }

  literatureData = data || [];
  renderAll();
}

// 渲染所有頁面
function renderAll() {
  updateStats();
  renderLiteratureList();
  renderMethodList();
  renderToolsCloud();
  renderKeywordsCloud();
  renderAPAList();
  renderNotesList();
}

// 更新統計
function updateStats() {
  const total = literatureData.length;
  const quant = literatureData.filter(l => l.research_type === '量化研究').length;
  const qual = literatureData.filter(l => l.research_type === '質性研究').length;
  const mixed = literatureData.filter(l => l.research_type === '混合研究').length;

  document.getElementById('total-count').textContent = total;
  document.getElementById('quant-count').textContent = quant;
  document.getElementById('qual-count').textContent = qual;
  document.getElementById('mixed-count').textContent = mixed;
}

// 渲染文獻列表
function renderLiteratureList() {
  const container = document.getElementById('literature-list');
  if (!container) return;

  if (literatureData.length === 0) {
    container.innerHTML = '<div class="card">尚無文獻資料，請點擊「新增文獻」開始建立。</div>';
    return;
  }

  container.innerHTML = literatureData.map(lit => `
    <div class="lit-item" data-id="${lit.id}">
      <div class="lit-header">
        <div class="lit-title">${lit.title || '無標題'}</div>
        <div style="display:flex;gap:6px">
          ${lit.pdf_url ? `<button class="pdf-btn" onclick="window.open('${lit.pdf_url}','_blank')">PDF</button>` : ''}
          <button class="edit-btn" onclick="editLiterature('${lit.id}')">編輯</button>
          <button class="delete-btn" onclick="deleteLiterature('${lit.id}')">刪除</button>
        </div>
      </div>
      <div class="lit-meta">${[lit.authors, lit.year, lit.journal].filter(Boolean).join(' · ')}</div>
      <div>
        ${lit.research_type ? `<span class="badge badge-${getTypeBadge(lit.research_type)}">${lit.research_type}</span>` : ''}
        ${parseTools(lit.analysis_tools).map(t => `<span class="badge badge-tool">${t}</span>`).join('')}
        ${parseKeywords(lit.keywords).slice(0, 4).map(k => `<span class="badge badge-kw">${k}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

// 渲染研究方法列表
function renderMethodList() {
  const container = document.getElementById('method-list');
  if (!container) return;

  if (literatureData.length === 0) {
    container.innerHTML = '<div class="card">尚無資料</div>';
    return;
  }

  container.innerHTML = literatureData.map(lit => `
    <div class="method-card" data-type="${lit.research_type || ''}">
      <div class="method-header">
        <div>
          <div class="method-title">${lit.title || '無標題'}</div>
          <div class="method-meta">${[lit.authors, lit.year].filter(Boolean).join(' · ')}</div>
        </div>
        ${lit.research_type ? `<span class="badge badge-${getTypeBadge(lit.research_type)}">${lit.research_type}</span>` : ''}
      </div>
      <div class="method-grid">
        <div class="method-block">
          <div class="method-block-label">${lit.research_type === '質性研究' ? '資料蒐集' : '研究方法'}</div>
          <div class="method-block-text">${lit.data_collection || '未填寫'}</div>
        </div>
        <div class="method-block">
          <div class="method-block-label">${lit.research_type === '質性研究' ? '資料分析' : '統計工具'}</div>
          <div class="method-block-text">${lit.analysis_tools || '未填寫'}</div>
        </div>
        <div class="method-block" style="grid-column:1/-1">
          <div class="method-block-label">研究對象</div>
          <div class="method-block-text">${lit.research_subjects || '未填寫'}</div>
        </div>
      </div>
    </div>
  `).join('');
}

// 渲染研究工具雲
function renderToolsCloud() {
  const toolsMap = {};
  literatureData.forEach(lit => {
    const tools = [...parseTools(lit.data_collection), ...parseTools(lit.analysis_tools)];
    tools.forEach(tool => {
      toolsMap[tool] = (toolsMap[tool] || 0) + 1;
    });
  });

  const sortedTools = Object.entries(toolsMap).sort((a, b) => b[1] - a[1]);

  const container = document.getElementById('tools-cloud');
  if (container) {
    container.innerHTML = sortedTools.map(([tool, count]) => `
      <span class="tool-pill" onclick="filterByTool('${tool}')">
        <span>${tool}</span>
        <span class="pill-count">${count}</span>
      </span>
    `).join('');
  }

  // 渲染量化和質性方法圖表
  renderToolCharts(toolsMap);
}

function renderToolCharts(toolsMap) {
  const quantTools = ['問卷調查', '結構方程模型', '多元迴歸', '階層迴歸', '相關分析', '描述統計', 't 檢定', 'ANOVA'];
  const qualTools = ['半結構訪談', '深度訪談', '主題分析', '內容分析', '文件分析', '紮根理論'];

  const quantContainer = document.getElementById('quant-tools-chart');
  const qualContainer = document.getElementById('qual-tools-chart');

  if (quantContainer) {
    const quantData = quantTools.map(t => [t, toolsMap[t] || 0]).filter(([, c]) => c > 0);
    const maxQuant = Math.max(...quantData.map(([, c]) => c), 1);
    quantContainer.innerHTML = quantData.map(([tool, count]) => `
      <div class="chart-bar">
        <div class="chart-label">${tool}</div>
        <div class="chart-track">
          <div class="chart-fill" style="width:${(count / maxQuant * 100)}%;background:#3b82f6"></div>
        </div>
        <div class="chart-value">${count}</div>
      </div>
    `).join('');
  }

  if (qualContainer) {
    const qualData = qualTools.map(t => [t, toolsMap[t] || 0]).filter(([, c]) => c > 0);
    const maxQual = Math.max(...qualData.map(([, c]) => c), 1);
    qualContainer.innerHTML = qualData.map(([tool, count]) => `
      <div class="chart-bar">
        <div class="chart-label">${tool}</div>
        <div class="chart-track">
          <div class="chart-fill" style="width:${(count / maxQual * 100)}%;background:#8b5cf6"></div>
        </div>
        <div class="chart-value">${count}</div>
      </div>
    `).join('');
  }
}

// 渲染關鍵字雲
function renderKeywordsCloud() {
  const kwMap = {};
  literatureData.forEach(lit => {
    parseKeywords(lit.keywords).forEach(kw => {
      kwMap[kw] = (kwMap[kw] || 0) + 1;
    });
  });

  const sortedKw = Object.entries(kwMap).sort((a, b) => b[1] - a[1]);

  const container = document.getElementById('keywords-cloud');
  if (container) {
    container.innerHTML = sortedKw.map(([kw, count]) => {
      const size = count >= 4 ? 'style="font-size:16px;font-weight:500"' : 
                   count >= 2 ? 'style="font-size:14px"' : 
                   'style="font-size:12px;color:var(--color-text-secondary)"';
      return `
        <span class="kw-pill" onclick="filterByKeyword('${kw}')">
          <span ${size}>${kw}</span>
          <span class="pill-count">${count}</span>
        </span>
      `;
    }).join('');
  }
}

// 渲染 APA 列表
function renderAPAList() {
  const container = document.getElementById('apa-list');
  if (!container) return;

  const sorted = [...literatureData].sort((a, b) => {
    const aAuthor = (a.authors || '').split('、')[0];
    const bAuthor = (b.authors || '').split('、')[0];
    return aAuthor.localeCompare(bAuthor, 'zh-TW');
  });

  container.innerHTML = sorted.map(lit => 
    `<div class="card"><div class="apa-item">${lit.apa_citation || '尚未填寫 APA 引用格式'}</div></div>`
  ).join('');
}

// 渲染筆記列表
function renderNotesList() {
  const container = document.getElementById('notes-list');
  if (!container) return;

  const notes = [];
  literatureData.forEach(lit => {
    const quotes = parseQuotes(lit.usable_quotes);
    quotes.forEach(quote => {
      notes.push({
        text: quote,
        source: `${lit.authors || '未知作者'}（${lit.year || '年份未知'}）`,
        keywords: parseKeywords(lit.keywords)
      });
    });
  });

  if (notes.length === 0) {
    container.innerHTML = '<div class="card">尚無可用段落</div>';
    return;
  }

  container.innerHTML = notes.map(note => `
    <div class="note-card">
      <div class="note-header">
        ${note.keywords.slice(0, 2).map(k => `<span class="badge badge-kw">${k}</span>`).join('')}
        <span class="note-source">${note.source}</span>
      </div>
      <div class="note-text">${note.text}</div>
    </div>
  `).join('');
}

// PDF 上傳處理
async function handlePDFUpload(file) {
  if (!config.anthropicKey) {
    showUploadStatus('請先在設定頁面填入 Anthropic API Key', 'error');
    showPage('settings');
    return;
  }

  showUploadStatus('正在上傳並分析 PDF...', 'loading');

  try {
    // 上傳 PDF 到 Supabase Storage
    let pdfUrl = null;
    if (supabase) {
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('pdfs')
        .upload(fileName, file);

      if (!error) {
        const { data: urlData } = supabase.storage
          .from('pdfs')
          .getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
      }
    }

    // 讀取 PDF 並轉換為 base64
    const base64 = await fileToBase64(file);

    // 呼叫 Claude API 萃取資訊
    const extractedData = await extractPDFData(base64);

    // 填入表單
    fillForm(extractedData);
    if (pdfUrl) {
      document.querySelector('input[name="pdf_url"]')?.value = pdfUrl;
    }

    showUploadStatus('分析完成！已自動填入表單', 'success');
  } catch (error) {
    console.error('PDF 處理錯誤:', error);
    showUploadStatus('處理失敗：' + error.message, 'error');
  }
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractPDFData(base64) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64
            }
          },
          {
            type: 'text',
            text: `請分析這篇學術文獻，以 JSON 格式回傳以下資訊（只回傳 JSON，不要有其他文字）：

{
  "title": "文獻標題",
  "authors": "作者（多位用頓號分隔）",
  "year": 出版年份（數字）,
  "journal": "期刊名稱",
  "apa_citation": "完整 APA 第 7 版引用格式",
  "research_type": "量化研究/質性研究/混合研究/文獻回顧/個案研究",
  "data_collection": "資料蒐集方法（如：問卷調查、深度訪談）",
  "analysis_tools": "統計或分析工具（如：結構方程模型、主題分析）",
  "research_subjects": "研究對象描述",
  "keywords": "關鍵字1, 關鍵字2, 關鍵字3",
  "results_summary": "研究結果摘要",
  "usable_quotes": "可引用的重要段落1---可引用的重要段落2"
}`
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    throw new Error(`API 錯誤: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text;
  
  // 移除可能的 markdown 程式碼區塊標記
  const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  return JSON.parse(jsonText);
}

function fillForm(data) {
  const form = document.getElementById('add-form');
  if (!form) return;

  Object.keys(data).forEach(key => {
    const input = form.querySelector(`[name="${key}"]`);
    if (input && data[key]) {
      input.value = data[key];
    }
  });
}

function showUploadStatus(message, type) {
  const status = document.getElementById('upload-status');
  if (!status) return;

  status.textContent = message;
  status.className = `upload-status ${type}`;
  status.style.display = 'block';

  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      status.style.display = 'none';
    }, 5000);
  }
}

// 儲存文獻
async function saveLiterature(formData) {
  const data = {
    title: formData.get('title'),
    authors: formData.get('authors'),
    year: parseInt(formData.get('year')) || null,
    journal: formData.get('journal'),
    apa_citation: formData.get('apa_citation'),
    research_type: formData.get('research_type'),
    research_method: formData.get('research_method'),
    data_collection: formData.get('data_collection'),
    analysis_tools: formData.get('analysis_tools'),
    research_subjects: formData.get('research_subjects'),
    keywords: formData.get('keywords'),
    results_summary: formData.get('results_summary'),
    usable_quotes: formData.get('usable_quotes'),
    pdf_url: formData.get('pdf_url')
  };

  if (!supabase) {
    alert('請先在設定頁面填入 Supabase 資訊');
    showPage('settings');
    return;
  }

  const { error } = await supabase
    .from('literature')
    .insert([data]);

  if (error) {
    alert('儲存失敗：' + error.message);
    return;
  }

  alert('儲存成功！');
  await loadLiterature();
  showPage('all');
}

// 刪除文獻
async function deleteLiterature(id) {
  if (!confirm('確定要刪除這篇文獻嗎？')) return;

  const { error } = await supabase
    .from('literature')
    .delete()
    .eq('id', id);

  if (error) {
    alert('刪除失敗：' + error.message);
    return;
  }

  await loadLiterature();
}

// 編輯文獻
async function editLiterature(id) {
  const lit = literatureData.find(l => l.id === id);
  if (!lit) return;

  showPage('add');
  
  const form = document.getElementById('add-form');
  Object.keys(lit).forEach(key => {
    const input = form.querySelector(`[name="${key}"]`);
    if (input && lit[key] !== null) {
      input.value = lit[key];
    }
  });

  // 修改表單提交行為為更新
  form.onsubmit = async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    formData.forEach((value, key) => {
      if (key === 'year') {
        data[key] = parseInt(value) || null;
      } else {
        data[key] = value || null;
      }
    });

    const { error } = await supabase
      .from('literature')
      .update(data)
      .eq('id', id);

    if (error) {
      alert('更新失敗：' + error.message);
      return;
    }

    alert('更新成功！');
    await loadLiterature();
    showPage('all');
    
    // 恢復原本的提交行為
    form.onsubmit = async (e) => {
      e.preventDefault();
      await saveLiterature(new FormData(e.target));
      e.target.reset();
    };
  };
}

// 篩選功能
function filterLiterature(query) {
  const items = document.querySelectorAll('.lit-item');
  const q = query.toLowerCase();
  
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(q) ? '' : 'none';
  });
}

function filterMethods(type) {
  const cards = document.querySelectorAll('.method-card');
  
  cards.forEach(card => {
    if (type === 'all' || card.dataset.type === type) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

function filterNotes(query) {
  const cards = document.querySelectorAll('.note-card');
  const q = query.toLowerCase();
  
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
}

function filterByTool(tool) {
  document.querySelectorAll('.tool-pill').forEach(p => p.classList.remove('selected'));
  event.target.closest('.tool-pill').classList.add('selected');

  const results = literatureData.filter(lit => {
    const tools = [...parseTools(lit.data_collection), ...parseTools(lit.analysis_tools)];
    return tools.some(t => t.includes(tool) || tool.includes(t));
  });

  document.getElementById('selected-tool').textContent = tool;
  document.getElementById('tool-filter-results').style.display = 'block';
  
  const container = document.getElementById('tool-results-list');
  container.innerHTML = results.map(lit => `
    <div class="method-card">
      <div class="method-title">${lit.title}</div>
      <div class="method-meta">${[lit.authors, lit.year].filter(Boolean).join(' · ')}</div>
      <div style="margin-top:8px">
        ${[...parseTools(lit.data_collection), ...parseTools(lit.analysis_tools)].map(t => 
          `<span class="badge ${t === tool || t.includes(tool) ? 'badge-tool' : 'badge-kw'}">${t}</span>`
        ).join('')}
      </div>
    </div>
  `).join('');
}

function clearToolFilter() {
  document.querySelectorAll('.tool-pill').forEach(p => p.classList.remove('selected'));
  document.getElementById('tool-filter-results').style.display = 'none';
}

function filterByKeyword(kw) {
  document.querySelectorAll('.kw-pill').forEach(p => p.classList.remove('selected'));
  event.target.closest('.kw-pill').classList.add('selected');

  const results = literatureData.filter(lit => 
    parseKeywords(lit.keywords).includes(kw)
  );

  document.getElementById('selected-keyword').textContent = kw;
  document.getElementById('kw-count').textContent = results.length;
  document.getElementById('keyword-filter-results').style.display = 'block';
  
  const container = document.getElementById('keyword-results-list');
  container.innerHTML = results.map(lit => `
    <div class="card">
      <div class="method-title">${lit.title}</div>
      <div class="method-meta">${[lit.authors, lit.year].filter(Boolean).join(' · ')}</div>
      <div style="margin-top:8px">
        ${parseKeywords(lit.keywords).map(k => 
          `<span class="badge ${k === kw ? 'badge-quant' : 'badge-kw'}">${k}</span>`
        ).join('')}
      </div>
    </div>
  `).join('');
}

function clearKeywordFilter() {
  document.querySelectorAll('.kw-pill').forEach(p => p.classList.remove('selected'));
  document.getElementById('keyword-filter-results').style.display = 'none';
}

// 設定功能
function loadSettings() {
  document.getElementById('anthropic-key').value = config.anthropicKey;
  document.getElementById('supabase-url').value = config.supabaseUrl;
  document.getElementById('supabase-key').value = config.supabaseKey;
}

function saveSettings() {
  config.anthropicKey = document.getElementById('anthropic-key').value.trim();
  config.supabaseUrl = document.getElementById('supabase-url').value.trim();
  config.supabaseKey = document.getElementById('supabase-key').value.trim();

  localStorage.setItem('anthropic_key', config.anthropicKey);
  localStorage.setItem('supabase_url', config.supabaseUrl);
  localStorage.setItem('supabase_key', config.supabaseKey);

  if (config.supabaseUrl && config.supabaseKey) {
    initSupabase();
    loadLiterature();
  }

  const status = document.getElementById('settings-status');
  status.textContent = '設定已儲存！';
  status.style.display = 'block';
  status.style.color = 'var(--color-success)';
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}

// 匯出/匯入
function exportData() {
  const json = JSON.stringify(literatureData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `literature_${Date.now()}.json`;
  a.click();
}

function importData() {
  document.getElementById('import-input').click();
  
  document.getElementById('import-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        alert('檔案格式錯誤');
        return;
      }

      if (confirm(`確定要匯入 ${data.length} 筆資料嗎？`)) {
        for (const item of data) {
          delete item.id;
          delete item.created_at;
          await supabase.from('literature').insert([item]);
        }
        
        await loadLiterature();
        alert('匯入完成！');
      }
    } catch (error) {
      alert('匯入失敗：' + error.message);
    }
  };
}

function copyAllAPA() {
  const sorted = [...literatureData].sort((a, b) => {
    const aAuthor = (a.authors || '').split('、')[0];
    const bAuthor = (b.authors || '').split('、')[0];
    return aAuthor.localeCompare(bAuthor, 'zh-TW');
  });

  const text = sorted.map(lit => lit.apa_citation).filter(Boolean).join('\n\n');
  
  navigator.clipboard.writeText(text).then(() => {
    alert('已複製到剪貼簿！');
  });
}

// 工具函數
function getTypeBadge(type) {
  if (type === '量化研究') return 'quant';
  if (type === '質性研究') return 'qual';
  if (type === '混合研究') return 'mixed';
  return 'kw';
}

function parseKeywords(str) {
  if (!str) return [];
  return str.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
}

function parseTools(str) {
  if (!str) return [];
  return str.split(/[,，、、]/).map(s => s.trim()).filter(Boolean);
}

function parseQuotes(str) {
  if (!str) return [];
  return str.split('---').map(s => s.trim()).filter(Boolean);
}
