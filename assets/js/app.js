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
    convertBtn: document.getElementById('convertBtn'),
    previewBody: document.getElementById('previewBody'),
    previewHead: document.getElementById('previewHead'),
    countNumber: document.getElementById('countNumber'),
    statusMsg: document.getElementById('statusMsg'),
    govCount: document.getElementById('govCount'),
    contractorCount: document.getElementById('contractorCount'),
    statusCount: document.getElementById('statusCount'),
    totalPagesNum: document.getElementById('totalPagesNum'),
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
    container.innerHTML = values
      .map((value) => `
        <label class="checkbox-item">
          <input type="checkbox" name="${name}" value="${value}">
          <span class="mr-2 text-sm">${value}</span>
        </label>
      `)
      .join('');

    container.querySelectorAll(`input[name="${name}"]`).forEach((checkbox) => {
      checkbox.addEventListener('change', onChange);
    });
  }

  function initSmartButtons() {
    dom.smartGroups.innerHTML = config.smartButtons
      .map(({ key, label }) => `<button type="button" class="group-btn ${key === 'all' ? 'active' : ''}" data-filter="${key}">${label}</button>`)
      .join('');

    dom.smartGroups.querySelectorAll('button[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        state.currentSmartFilter = button.dataset.filter;
        dom.smartGroups.querySelectorAll('.group-btn').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.filter === state.currentSmartFilter);
        });
        updateGlobalFilters();
      });
    });
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
    dom.govContainer.innerHTML = availableGovs
      .map((code, i) => `
        <label class="checkbox-item">
          <input type="checkbox" name="gov" value="${code}">
          <span class="mr-2 text-sm">${displayValues[i]}</span>
        </label>
      `)
      .join('');

    dom.govContainer.querySelectorAll('input[name="gov"]').forEach((checkbox) => {
      checkbox.addEventListener('change', updateContractorOptions);
    });

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
  }

  function renderPreview() {
    dom.countNumber.innerText = state.filteredData.length;
    const totalPages = Math.max(1, Math.ceil(state.filteredData.length / config.rowsPerPage));
    dom.totalPagesNum.innerText = totalPages;
    dom.currentPageNum.innerText = state.currentPage;
    dom.prevPage.disabled = state.currentPage === 1;
    dom.nextPage.disabled = state.currentPage === totalPages;

    if (!state.filteredData.length) {
      dom.previewHead.innerHTML = '';
      dom.previewBody.innerHTML = '<tr><td colspan="100%" class="text-center py-12 text-slate-400">لا توجد بيانات تطابق الفلاتر</td></tr>';
      return;
    }

    const visibleKeys = Object.keys(state.filteredData[0]).filter((k) => !config.alwaysDeleteColumns.includes(k));
    dom.previewHead.innerHTML = `<tr>${visibleKeys.map((k) => `<th>${k}</th>`).join('')}</tr>`;

    const start = (state.currentPage - 1) * config.rowsPerPage;
    const end = state.currentPage * config.rowsPerPage;
    const pageData = state.filteredData.slice(start, end);

    dom.previewBody.innerHTML = pageData
      .map((row) => `<tr>${visibleKeys.map((key) => `<td>${String(row[key] ?? '')}</td>`).join('')}</tr>`)
      .join('');
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

  /**
   * دالة التصدير مع تحجيم تلقائي للأعمدة (AutoFit)
   */
  function exportExcel(data, fileName, status) {
    const statusText = (status || '').toString().toLowerCase();
    const isPendingOnly = statusText.includes('pending') && !statusText.includes('done');

    const processed = data.map((row) => {
      const next = { ...row };
      config.alwaysDeleteColumns.forEach((column) => delete next[column]);
      if (isPendingOnly) config.pendingOnlyDeleteColumns.forEach((column) => delete next[column]);

      if (next.CreatedOn) {
        const created = new Date(next.CreatedOn);
        if (!Number.isNaN(created.getTime())) {
          next.CreatedOn = `${created.getFullYear()}/${created.getMonth() + 1}/${created.getDate()}`;
        }
      }
      return next;
    });

    const ws = XLSX.utils.json_to_sheet(processed);

    // منطق التحجيم التلقائي للأعمدة (Auto-Fit)
    if (processed.length > 0) {
      const objectKeys = Object.keys(processed[0]);
      const colWidths = objectKeys.map(key => {
        // حساب الطول الأقصى للرؤوس والبيانات
        const headerLen = key.toString().length;
        const maxDataLen = processed.reduce((max, row) => {
          const cellValue = row[key] ? row[key].toString().length : 0;
          return Math.max(max, cellValue);
        }, headerLen);
        
        // استخدام معامل 1.2 لمراعاة عرض الحروف العربية وترك مساحة صغيرة (Buffer)
        return { wch: (maxDataLen * 1.2) + 2 };
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

          const filename = [
            config.govMap[gov] || gov,
            contractor,
            status,
            new Date().toISOString().split('T')[0]
          ]
            .map(sanitizeFilename)
            .join('_');

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
