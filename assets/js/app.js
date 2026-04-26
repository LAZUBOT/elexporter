(() => {
  const config = window.EL_CONVERTER_CONFIG;
  if (!config) {
    console.error('EL_CONVERTER_CONFIG is missing.');
    return;
  }

  const state = {
    rawData: [],
    filteredData: [],
    currentPage: 1,
    currentSmartFilter: 'all'
  };

  const dom = {
    csvInput: document.getElementById('csvInput'),
    configSection: document.getElementById('configSection'),
    govContainer: document.getElementById('govContainer'),
    contractorContainer: document.getElementById('contractorContainer'),
    statusContainer: document.getElementById('statusContainer'),
    smartGroupContainer: document.getElementById('smartGroupContainer'),
    smartGroups: document.getElementById('smartGroups'),
    zoneNameInput: document.getElementById('zoneNameFilter'),
      smartSelectionNote: document.getElementById('smartSelectionNote'),
    currentPageNum: document.getElementById('currentPageNum'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage')
  };

  function getCheckedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((cb) => cb.value);
  }

  function getZoneValue(row) {
    return (row['Zone Name'] || '').toString().toUpperCase();
  }

  function buildCheckboxes(container, name, values, onChange) {
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    values.forEach((value) => {
      const label = document.createElement('label');
      label.className = 'checkbox-item';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = name;
      input.value = value;

      const span = document.createElement('span');
      span.className = 'mr-2 text-sm';
      span.textContent = value;

      label.appendChild(input);
      label.appendChild(span);
      fragment.appendChild(label);

      input.addEventListener('change', onChange);
    });

    container.appendChild(fragment);
  }

  function initSmartButtons() {
    dom.smartGroups.innerHTML = '';
    const fragment = document.createDocumentFragment();

    config.smartButtons.forEach(({ key, label }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `group-btn ${key === 'all' ? 'active' : ''}`;
      button.dataset.filter = key;
      button.textContent = label;

      button.addEventListener('click', () => {
        state.currentSmartFilter = button.dataset.filter;
        dom.smartGroups.querySelectorAll('.group-btn').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.filter === state.currentSmartFilter);
        });
        updateGlobalFilters();
        updateSmartNote();
      });

      fragment.appendChild(button);
    });

    dom.smartGroups.appendChild(fragment);
  }

  function parseCsv(file) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        state.rawData = Array.isArray(results.data) ? results.data : [];
        initGovs();
        dom.configSection.classList.remove('hidden');
        updateGlobalFilters();
      },
      error: () => {
        showStatus('فشل في قراءة ملف CSV. تأكد من سلامة الملف.', 'bg-red-100 text-red-700');
      }
    });
  }

  function initGovs() {
    const availableGovs = [...new Set(state.rawData.map((r) => getZoneValue(r).substring(0, 3)))]
      .filter((code) => config.govMap[code])
      .sort();

    const displayValues = availableGovs.map((code) => `${config.govMap[code]} (${code})`);
    dom.govContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    availableGovs.forEach((code, i) => {
      const label = document.createElement('label');
      label.className = 'checkbox-item';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'gov';
      input.value = code;

      const span = document.createElement('span');
      span.className = 'mr-2 text-sm';
      span.textContent = displayValues[i];

      label.appendChild(input);
      label.appendChild(span);
      fragment.appendChild(label);

      input.addEventListener('change', updateContractorOptions);
    });

    dom.govContainer.appendChild(fragment);
    updateContractorOptions();
  }

  function filterBySelections(rows, selectedGovs, selectedCons, selectedStats, zoneQuery) {
    return rows.filter((row) => {
      const zoneStr = getZoneValue(row);
      const zoneNum = parseInt(zoneStr.match(/\d+/)?.[0] || '-1', 10);
      const contractor = (row['Zone Contractor'] || '').toString();
      const status = (row.Status || '').toString();

      const matchesGov = selectedGovs.length === 0 || selectedGovs.some((g) => zoneStr.startsWith(g));
      const matchesCon = selectedCons.length === 0 || selectedCons.includes(contractor);
      const matchesStat = selectedStats.length === 0 || selectedStats.includes(status);
      const matchesManual = !zoneQuery || zoneStr.toLowerCase().includes(zoneQuery);

      let matchesSmart = true;
      if (selectedGovs.length === 1 && selectedGovs[0] === 'FTK' && state.currentSmartFilter !== 'all') {
        const smartConfig = config.smartZones[state.currentSmartFilter] || { ranges: [], specials: [] };
        matchesSmart =
          smartConfig.ranges.some((range) => zoneNum >= range[0] && zoneNum <= range[1]) ||
          smartConfig.specials.includes(zoneNum);
      }

      return matchesGov && matchesCon && matchesStat && matchesManual && matchesSmart;
    });
  }

  function updateContractorOptions() {
    const selectedGovs = getCheckedValues('gov');

    if (selectedGovs.length === 1 && selectedGovs[0] === 'FTK') {
      dom.smartGroupContainer.classList.remove('hidden');
    } else {
      dom.smartGroupContainer.classList.add('hidden');
      state.currentSmartFilter = 'all';
      dom.smartGroups.querySelectorAll('.group-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === 'all');
      });
    }

    updateSmartNote();

    const subset = filterBySelections(state.rawData, selectedGovs, [], [], '');
    const contractors = [...new Set(subset.map((row) => (row['Zone Contractor'] || '').toString()).filter(Boolean))].sort();
    buildCheckboxes(dom.contractorContainer, 'contractor', contractors, updateStatusOptions);
    updateStatusOptions();
  }

  function updateStatusOptions() {
    const selectedGovs = getCheckedValues('gov');
    const selectedCons = getCheckedValues('contractor');
    const subset = filterBySelections(state.rawData, selectedGovs, selectedCons, [], '');
    const statuses = [...new Set(subset.map((row) => (row.Status || '').toString()).filter(Boolean))].sort();
    buildCheckboxes(dom.statusContainer, 'status', statuses, updateGlobalFilters);
    updateGlobalFilters();
  }

  function updateGlobalFilters() {
    const selectedGovs = getCheckedValues('gov');
    const selectedCons = getCheckedValues('contractor');
    const selectedStats = getCheckedValues('status');
    const zoneQuery = dom.zoneNameInput.value.trim().toLowerCase();

    dom.govCount.innerText = selectedGovs.length;
    dom.contractorCount.innerText = selectedCons.length;
    dom.statusCount.innerText = selectedStats.length;

    state.filteredData = filterBySelections(state.rawData, selectedGovs, selectedCons, selectedStats, zoneQuery);
    state.currentPage = 1;
    renderPreview();
    updateSmartNote();
  }

  function renderPreview() {
    dom.countNumber.innerText = state.filteredData.length;
    const totalPages = Math.max(1, Math.ceil(state.filteredData.length / config.rowsPerPage));
    dom.totalPagesNum.innerText = totalPages;
    dom.currentPageNum.innerText = state.currentPage;
    dom.prevPage.disabled = state.currentPage === 1;
    dom.nextPage.disabled = state.currentPage === totalPages;

    dom.previewHead.innerHTML = '';
    dom.previewBody.innerHTML = '';

    if (!state.filteredData.length) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 100;
      emptyCell.className = 'text-center py-12 text-slate-400';
      emptyCell.textContent = 'لا توجد بيانات تطابق الفلاتر';
      emptyRow.appendChild(emptyCell);
      dom.previewBody.appendChild(emptyRow);
      return;
    }

    const visibleKeys = Object.keys(state.filteredData[0]).filter((k) => !config.alwaysDeleteColumns.includes(k));
    const headerRow = document.createElement('tr');
    visibleKeys.forEach((key) => {
      const th = document.createElement('th');
      th.textContent = key;
      headerRow.appendChild(th);
    });
    dom.previewHead.appendChild(headerRow);

    const start = (state.currentPage - 1) * config.rowsPerPage;
    const end = state.currentPage * config.rowsPerPage;
    const pageData = state.filteredData.slice(start, end);

    pageData.forEach((row) => {
      const tr = document.createElement('tr');
      visibleKeys.forEach((key) => {
        const td = document.createElement('td');
        td.textContent = String(row[key] ?? '');
        tr.appendChild(td);
      });
      dom.previewBody.appendChild(tr);
    });
  }

  function changePage(direction) {
    const totalPages = Math.max(1, Math.ceil(state.filteredData.length / config.rowsPerPage));
    const nextPage = state.currentPage + direction;
    state.currentPage = Math.min(totalPages, Math.max(1, nextPage));
    renderPreview();
  }

  function sanitizeFilename(value) {
    return (value || 'NA').toString().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
  }

  function escapeExcelValue(value) {
    if (typeof value !== 'string') return value;
    if (/^[=+\-@]/.test(value)) {
      return `'${value}`;
    }
    return value;
  }

  function getSelectedSmartLabel() {
    if (state.currentSmartFilter === 'all') return '';
    const button = config.smartButtons.find((item) => item.key === state.currentSmartFilter);
    return button ? button.label : state.currentSmartFilter;
  }

  function updateSmartNote() {
    const selectedGovs = getCheckedValues('gov');
    if (selectedGovs.length === 1 && selectedGovs[0] === 'FTK' && state.currentSmartFilter !== 'all') {
      dom.smartSelectionNote.innerText = `سيُضاف إلى اسم الملف: المنطقة الذكية "${getSelectedSmartLabel()}".`;
      dom.smartSelectionNote.classList.remove('hidden');
    } else {
      dom.smartSelectionNote.innerText = '';
      dom.smartSelectionNote.classList.add('hidden');
    }
  }

  function exportExcel(data, fileName, status) {
    const statusText = (status || '').toString().toLowerCase();
    const isPendingOnly = statusText.includes('pending') && !statusText.includes('done');

    const processed = data.map((row) => {
      const next = { ...row };
      config.alwaysDeleteColumns.forEach((column) => delete next[column]);
      if (isPendingOnly) config.pendingOnlyDeleteColumns.forEach((column) => delete next[column]);

      // 1. تنظيف المسافات الزائدة (مسافتين أو أكثر تصبح مسافة واحدة)
      Object.keys(next).forEach(key => {
        if (typeof next[key] === 'string') {
          next[key] = next[key].replace(/\s\s+/g, ' ').trim();
          next[key] = escapeExcelValue(next[key]);
        }
      });

      if (next.CreatedOn) {
        const created = new Date(next.CreatedOn);
        if (!Number.isNaN(created.getTime())) {
          next.CreatedOn = escapeExcelValue(`${created.getFullYear()}/${created.getMonth() + 1}/${created.getDate()}`);
        }
      }
      return next;
    });

    const ws = XLSX.utils.json_to_sheet(processed);

    // 2. تحجيم تلقائي دقيق (بدون زيادة مبالغ فيها)
    if (processed.length > 0) {
      const objectKeys = Object.keys(processed[0]);
      const colWidths = objectKeys.map(key => {
        const headerLen = key.toString().length;
        const maxDataLen = processed.reduce((max, row) => {
          const val = row[key] ? row[key].toString().length : 0;
          return Math.max(max, val);
        }, headerLen);
        
        // العرض المناسب تماماً مع إضافة هامش بسيط (1) لمنع التصاق النص
        return { wch: maxDataLen + 1 };
      });
      ws['!cols'] = colWidths;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, config.defaultSheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }

  function handleExport() {
    if (!state.filteredData.length) {
      alert('لا توجد بيانات للتصدير');
      return;
    }

    const selectedGovs = getCheckedValues('gov');
    const selectedCons = getCheckedValues('contractor');
    const selectedStats = getCheckedValues('status');

    const govsToLoop = selectedGovs.length ? selectedGovs : ['AllGovs'];
    const consToLoop = selectedCons.length ? selectedCons : ['AllContractors'];
    const statsToLoop = selectedStats.length ? selectedStats : ['AllStatus'];

    let fileCount = 0;
    govsToLoop.forEach((gov) => {
      consToLoop.forEach((contractor) => {
        statsToLoop.forEach((status) => {
          const subset = state.filteredData.filter((row) => {
            const zone = getZoneValue(row);
            const rowContractor = (row['Zone Contractor'] || '').toString();
            const rowStatus = (row.Status || '').toString();

            const matchGov = gov === 'AllGovs' || zone.startsWith(gov);
            const matchCon = contractor === 'AllContractors' || rowContractor === contractor;
            const matchStatus = status === 'AllStatus' || rowStatus === status;
            return matchGov && matchCon && matchStatus;
          });

          if (!subset.length) return;

          const smartLabel = gov === 'FTK' && state.currentSmartFilter !== 'all' ? getSelectedSmartLabel() : '';
          const filenameParts = [
            config.govMap[gov] || gov,
            smartLabel,
            contractor,
            status,
            new Date().toISOString().split('T')[0]
          ].filter(Boolean);

          const filename = filenameParts.map(sanitizeFilename).join('_');

          exportExcel(subset, filename, status);
          fileCount += 1;
        });
      });
    });

    showStatus(`تم تنزيل ${fileCount} ملف بنجاح`, 'bg-green-100 text-green-700');
  }

  function showStatus(message, classes) {
    dom.statusMsg.innerText = message;
    dom.statusMsg.className = `p-4 text-center text-sm font-bold border-t ${classes}`;
    dom.statusMsg.classList.remove('hidden');
  }

  function initEvents() {
    dom.csvInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) parseCsv(file);
    });
    dom.zoneNameInput.addEventListener('input', updateGlobalFilters);
    dom.convertBtn.addEventListener('click', handleExport);
    dom.prevPage.addEventListener('click', () => changePage(-1));
    dom.nextPage.addEventListener('click', () => changePage(1));
  }

  initSmartButtons();
  initEvents();
})();
