// Global Application State
let appState = {
  rawData: [],
  competitors: [], // parsed row objects
  rings: {},       // ring_number -> Array of Event Groups
  divisions: [],   // Unique division codes
  eventsList: [],  // Unique event codes + names for filter
  currentView: 'news',
  selectedRing: 'all',
  searchQuery: '',
  lastUpdated: null,
  refreshIntervalId: null,
  isReloading: false,
  news: [
    {
      id: 1,
      title: "⚠️ Schedule Delay for Ring 3 (三号场地日程延迟通知)",
      date: "May 24, 09:30 AM",
      content: "Due to the high number of competitors in the Shaolin Staff events, subsequent events in Ring 3 will run approximately 15 minutes behind schedule. All athletes are advised to check in with the Ring Coordinator."
    },
    {
      id: 2,
      title: "🏆 Grand Champion trials starting at 3:00 PM (全能总决赛下午三点开始)",
      date: "May 24, 09:00 AM",
      content: "The Grand Champion trials for all Advanced divisions will commence at Ring 1 at 3:00 PM today. Come support your team and watch the finest athletes compete!"
    },
    {
      id: 3,
      title: "🥪 Cafeteria Lunch distribution details (工作餐领用说明)",
      date: "May 23, 11:30 AM",
      content: "Pre-ordered competitor lunch boxes are now ready for pickup at the Sequoia High School Cafeteria. Please present your competitor wristband or ID badge between 11:30 AM and 1:30 PM."
    },
    {
      id: 4,
      title: "📢 Welcome to the 2026 Championships! (欢迎参加2026年武术锦标赛)",
      date: "May 23, 08:00 AM",
      content: "Welcome to Sequoia High School! Competitor registration packets and wristbands are distributed at the entrance. All athletes must check in 15 minutes before their scheduled events. Good luck!"
    }
  ]
};

// CSV URL (Direct published Google Sheet output)
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGRY1WZpcxgs73NFVy1mE-2XBKlo-qxx9NlM-fpFJSdh6sV7HJ8Jvru7UqssUewN_Ogh0kTfXIwRYS/pub?gid=1154079730&single=true&output=csv";

// CSV Parser supporting quotes and commas (pure JS)
function parseCSV(text) {
  let lines = [];
  let row = [""];
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    let next = text[i + 1];
    
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push("");
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += c;
    }
  }
  
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  
  return lines;
}

// Convert parsed CSV lines to objects
function processRawCSV(lines) {
  if (lines.length < 2) return [];
  
  const headers = lines[0].map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < headers.length) continue;
    
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = line[index] ? line[index].trim() : '';
    });
    
    // Parse helper values
    obj.ring_number = parseInt(obj.ring_number) || 0;
    obj.event_order = parseInt(obj.event_order) || 0;
    
    // Normalize Score
    const totalScore = obj.Total;
    const isScored = totalScore && totalScore !== '-' && totalScore !== '0' && !isNaN(parseFloat(totalScore));
    obj.isScored = isScored;
    obj.scoreValue = isScored ? parseFloat(totalScore) : 0;
    
    rows.push(obj);
  }
  
  return rows;
}

// Append some mock pending events for demonstration/testing
function injectMockPendingEvents(rows) {
  const mockPendingData = [
    // Mock Event 1: Ring 2, Order 99, Division: M-A3-Adv, Event: A01 (XingYi, BaGua, BaJi)
    // 2 scored, 1 unscored -> Pending
    {
      ring_number: 2,
      event_order: 99,
      division_code: "M-A3-Adv",
      event_code: "A01",
      event_name: "XingYi, BaGua, BaJi 形意，八卦，八极 (Mock Pending)",
      competitor_name: "Chen, Long (陈龙)",
      competitor_id: 901,
      grand_champion: "FALSE",
      team_trial: "FALSE",
      Total: "8.92",
      isScored: true,
      scoreValue: 8.92
    },
    {
      ring_number: 2,
      event_order: 99,
      division_code: "M-A3-Adv",
      event_code: "A01",
      event_name: "XingYi, BaGua, BaJi 形意，八卦，八极 (Mock Pending)",
      competitor_name: "Lee, Bruce (李小龙)",
      competitor_id: 902,
      grand_champion: "FALSE",
      team_trial: "FALSE",
      Total: "8.85",
      isScored: true,
      scoreValue: 8.85
    },
    {
      ring_number: 2,
      event_order: 99,
      division_code: "M-A3-Adv",
      event_code: "A01",
      event_name: "XingYi, BaGua, BaJi 形意，八卦，八极 (Mock Pending)",
      competitor_name: "Wang, Fei (王飞)",
      competitor_id: 903,
      grand_champion: "FALSE",
      team_trial: "FALSE",
      Total: "-",
      isScored: false,
      scoreValue: 0
    },
    
    // Mock Event 2: Ring 4, Order 99, Division: F-A3-Adv, Event: B01 (Shaolin Single Broadsword)
    // 1 scored, 1 unscored -> Pending
    {
      ring_number: 4,
      event_order: 99,
      division_code: "F-A3-Adv",
      event_code: "B01",
      event_name: "Shaolin Single Broadsword 少林单刀 (Mock Pending)",
      competitor_name: "Zhang, Ziyi (章子怡)",
      competitor_id: 911,
      grand_champion: "FALSE",
      team_trial: "FALSE",
      Total: "9.10",
      isScored: true,
      scoreValue: 9.10
    },
    {
      ring_number: 4,
      event_order: 99,
      division_code: "F-A3-Adv",
      event_code: "B01",
      event_name: "Shaolin Single Broadsword 少林单刀 (Mock Pending)",
      competitor_name: "Yeoh, Michelle (杨紫琼)",
      competitor_id: 912,
      grand_champion: "FALSE",
      team_trial: "FALSE",
      Total: "-",
      isScored: false,
      scoreValue: 0
    },

    // Mock Event 3: Ring 5, Order 99, Division: M-A3-Int-A, Event: B07 (Traditional Southern Broadsword)
    // 2 scored, 1 unscored -> Pending
    {
      ring_number: 5,
      event_order: 99,
      division_code: "M-A3-Int-A",
      event_code: "B07",
      event_name: "Traditional Southern Broadsword 传统南刀 (Mock Pending)",
      competitor_name: "IP, Man (叶问)",
      competitor_id: 921,
      grand_champion: "FALSE",
      team_trial: "FALSE",
      Total: "8.65",
      isScored: true,
      scoreValue: 8.65
    },
    {
      ring_number: 5,
      event_order: 99,
      division_code: "M-A3-Int-A",
      event_code: "B07",
      event_name: "Traditional Southern Broadsword 传统南刀 (Mock Pending)",
      competitor_name: "Hung, Sammo (洪金宝)",
      competitor_id: 922,
      grand_champion: "FALSE",
      team_trial: "FALSE",
      Total: "-",
      isScored: false,
      scoreValue: 0
    }
  ];
  
  return [...rows, ...mockPendingData];
}

// Group data for various views
function updateGroupings() {
  const data = appState.competitors;
  
  // 1. Group by Ring and Event Order
  const ringsMap = {};
  const divisionSet = new Set();
  const eventMap = new Map();
  
  data.forEach(item => {
    if (item.division_code) divisionSet.add(item.division_code);
    if (item.event_code) {
      eventMap.set(item.event_code, item.event_name);
    }
    
    const ringNum = item.ring_number;
    if (ringNum > 0) {
      if (!ringsMap[ringNum]) ringsMap[ringNum] = {};
      
      // We group by event_order + event_code to ensure uniqueness
      const eventKey = `${item.event_order}_${item.event_code}`;
      if (!ringsMap[ringNum][eventKey]) {
        ringsMap[ringNum][eventKey] = {
          ring_number: ringNum,
          event_order: item.event_order,
          event_code: item.event_code,
          event_name: item.event_name,
          competitors: []
        };
      }
      ringsMap[ringNum][eventKey].competitors.push(item);
    }
  });
  
  // Convert ringsMap structure into sorted array of events per ring
  const finalRings = {};
  Object.keys(ringsMap).forEach(ringNum => {
    const ringEvents = Object.values(ringsMap[ringNum]);
    // Sort by event_order
    ringEvents.sort((a, b) => a.event_order - b.event_order);
    
    // FAKE LOGIC: Simulate a tournament currently in progress (halfway through the schedule).
    // We target the 5th event (index 4) as the currently active/pending event.
    // If a ring has fewer than 5 events, we target the middle event.
    if (ringEvents.length > 0) {
      const activeIdx = ringEvents.length >= 5 ? 4 : Math.floor(ringEvents.length / 2);
      
      ringEvents.forEach((evt, idx) => {
        if (idx === activeIdx) {
          // The currently active event: clear all scores so it shows as "Pending" (Waiting)
          evt.competitors.forEach(comp => {
            comp.isScored = false;
            comp.Total = '-';
            comp.scoreValue = 0;
          });
        } else if (idx > activeIdx) {
          // Future upcoming events: clear all scores
          evt.competitors.forEach(comp => {
            comp.isScored = false;
            comp.Total = '-';
            comp.scoreValue = 0;
          });
        }
        // If idx < activeIdx, we keep the original scores from the Google Sheet (completed events)
      });
    }
    
    finalRings[ringNum] = ringEvents;
  });
  
  appState.rings = finalRings;
  appState.divisions = Array.from(divisionSet).sort();
  
  // Format event selector list
  appState.eventsList = Array.from(eventMap.entries()).map(([code, name]) => {
    return { code, name };
  }).sort((a, b) => a.code.localeCompare(b.code));
}

// Initial Data Fetching
async function loadData(silent = false) {
  if (appState.isReloading) return;
  appState.isReloading = true;
  
  const refreshIcon = document.getElementById('refresh-icon');
  const loadingState = document.getElementById('loading-state');
  const errorState = document.getElementById('error-state');
  const lastUpdatedText = document.getElementById('last-updated-text');
  
  if (refreshIcon) refreshIcon.classList.add('spin');
  if (!silent && loadingState) {
    loadingState.style.display = 'flex';
    document.getElementById('view-rings').style.display = 'none';
    document.getElementById('view-leaderboard').style.display = 'none';
    document.getElementById('view-search').style.display = 'none';
  }
  if (errorState) errorState.style.display = 'none';

  try {
    // Force reload by appending timestamp query parameter to bypass cache
    const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&t=${new Date().getTime()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    
    // Parse
    const parsedLines = parseCSV(csvText);
    appState.competitors = injectMockPendingEvents(processRawCSV(parsedLines));
    
    // Group
    updateGroupings();
    
    // Set Timestamp
    appState.lastUpdated = new Date();
    if (lastUpdatedText) {
      lastUpdatedText.textContent = `Updated: ${appState.lastUpdated.toLocaleTimeString()}`;
    }
    
    if (loadingState) loadingState.style.display = 'none';
    
    // Populate Dropdowns if not done already
    populateFilters();
    
    // Render
    renderActiveView();
    
    if (silent) {
      showToast("Data refreshed!");
    } else {
      // Restore the view that should be visible
      switchView(appState.currentView);
    }
  } catch (error) {
    console.error("Data load failure:", error);
    if (lastUpdatedText) lastUpdatedText.textContent = "Update failed";
    
    if (!silent) {
      if (loadingState) loadingState.style.display = 'none';
      if (errorState) {
        errorState.style.display = 'flex';
        document.getElementById('error-message').textContent = `Failed to fetch data: ${error.message}. Please check that the Google Sheet is published to the web.`;
      }
    } else {
      showToast("Auto-refresh failed!");
    }
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('spin');
    appState.isReloading = false;
  }
}

// User-triggered reload
function reloadData() {
  loadData(true);
}

// Populate Division and Event Filter Dropdowns
let filtersPopulated = false;
function populateFilters() {
  if (filtersPopulated) return;
  
  const divSelect = document.getElementById('filter-division');
  const eventSelect = document.getElementById('filter-event');
  
  if (!divSelect || !eventSelect) return;
  
  // Populate divisions
  appState.divisions.forEach(div => {
    const opt = document.createElement('option');
    opt.value = div;
    opt.textContent = div;
    divSelect.appendChild(opt);
  });
  
  // Populate events
  appState.eventsList.forEach(event => {
    const opt = document.createElement('option');
    opt.value = event.code;
    opt.textContent = `${event.code} - ${event.name}`;
    eventSelect.appendChild(opt);
  });
  
  filtersPopulated = true;
}

// Show Toast Alert
function showToast(message) {
  const toast = document.getElementById('toast-message');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// Navigation / View Swapping
function switchView(viewName) {
  appState.currentView = viewName;
  
  // Update Tabs UI
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
  });
  
  const activeTab = document.getElementById(`tab-${viewName}`);
  if (activeTab) {
    activeTab.classList.add('active');
    activeTab.setAttribute('aria-selected', 'true');
  }
  
  // Update Panes UI
  document.querySelectorAll('.view-pane').forEach(pane => {
    pane.style.display = 'none';
  });
  
  const activePane = document.getElementById(`view-${viewName}`);
  if (activePane) {
    activePane.style.display = 'block';
  }
  
  // Focus logic/View specific actions
  if (viewName === 'search') {
    const searchInput = document.getElementById('global-search');
    if (searchInput) searchInput.focus();
  }
  
  // Render View
  renderActiveView();
}

function renderActiveView() {
  updateTicker();
  
  if (appState.currentView === 'rings') {
    renderRings();
  } else if (appState.currentView === 'leaderboard') {
    updateLeaderboard();
  } else if (appState.currentView === 'search') {
    renderSearchResults();
  } else if (appState.currentView === 'news') {
    renderNews();
  }
}

// ==========================================
// 1. RINGS VIEW LOGIC
// ==========================================

function filterRing(ringNum) {
  appState.selectedRing = ringNum;
  
  // Update Filter buttons UI
  document.querySelectorAll('.ring-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeBtn = event.currentTarget;
  if (activeBtn) activeBtn.classList.add('active');
  
  renderRings();
}

// Render dynamic Ring buttons and Ring Cards
function renderRings() {
  const container = document.getElementById('rings-grid');
  const buttonsContainer = document.getElementById('ring-buttons-container');
  if (!container) return;
  
  const ringKeys = Object.keys(appState.rings).sort((a, b) => parseInt(a) - parseInt(b));
  
  // Render Ring buttons if empty
  if (buttonsContainer && buttonsContainer.children.length <= 1) {
    ringKeys.forEach(ringNum => {
      const btn = document.createElement('button');
      btn.className = 'ring-btn';
      btn.textContent = `Ring ${ringNum}`;
      btn.onclick = (e) => filterRing(ringNum);
      buttonsContainer.appendChild(btn);
    });
  }
  
  container.innerHTML = '';
  
  const ringsToRender = appState.selectedRing === 'all' 
    ? ringKeys 
    : [appState.selectedRing];
    
  ringsToRender.forEach(ringNum => {
    const events = appState.rings[ringNum] || [];
    if (events.length === 0) return;
    
    // Find the Active Event: First event order where NOT all competitors have score values
    let activeEventIndex = -1;
    for (let i = 0; i < events.length; i++) {
      const anyUnscored = events[i].competitors.some(c => !c.isScored);
      if (anyUnscored) {
        activeEventIndex = i;
        break;
      }
    }
    
    // Determine overall ring status
    let ringStatus = "Waiting";
    let statusClass = "status-waiting-badge";
    
    if (activeEventIndex !== -1) {
      ringStatus = "Live Now";
      statusClass = "status-active-badge";
    } else if (events.length > 0) {
      ringStatus = "Completed";
      statusClass = "status-completed-badge";
    }
    
    const card = document.createElement('div');
    card.className = 'ring-card';
    
    // Build Header
    let cardHTML = `
      <div class="ring-header">
        <h3 class="ring-title">Ring ${ringNum}</h3>
        <span class="status-badge ${statusClass}">
          <span class="status-dot"></span>${ringStatus}
        </span>
      </div>
      <div class="ring-events-list">
    `;
    
    events.forEach((evt, idx) => {
      const isActive = idx === activeEventIndex;
      const isCompleted = idx < activeEventIndex || activeEventIndex === -1;
      
      const totalCompetitors = evt.competitors.length;
      const scoredLength = evt.competitors.filter(c => c.isScored).length;
      
      let eventStatusText = "Upcoming";
      let eventStatusClass = "status-waiting-badge";
      
      if (isActive) {
        eventStatusText = `Live (${scoredLength}/${totalCompetitors})`;
        eventStatusClass = "status-active-badge";
      } else if (idx === activeEventIndex + 1 && activeEventIndex !== -1) {
        eventStatusText = "On Deck (候场请检录)";
        eventStatusClass = "status-ondeck-badge";
      } else if (isCompleted) {
        eventStatusText = "Completed";
        eventStatusClass = "status-completed-badge";
      }
      
      const showDot = isActive || (idx === activeEventIndex + 1 && activeEventIndex !== -1);
      
      // Active event is fully expanded, others are compressed toggles
      cardHTML += `
        <div class="event-item ${isActive ? 'active-event' : ''}">
          <div class="event-meta">
            <span class="event-order">Order #${evt.event_order}</span>
            <span class="status-badge ${eventStatusClass}" style="padding: 2px 8px; font-size: 0.7rem;">
              ${showDot ? '<span class="status-dot"></span>' : ''}${eventStatusText}
            </span>
          </div>
          <div class="event-code">${evt.event_code}</div>
          <div class="event-name">${evt.event_name}</div>
          
          <div class="competitor-list" style="display: ${isActive ? 'flex' : 'none'};" id="comp-list-${ringNum}-${evt.event_order}">
            ${evt.competitors.map(comp => `
              <div class="competitor-row">
                <div class="competitor-info">
                  <span class="competitor-name">${comp.competitor_name}</span>
                  <span class="competitor-id">#${comp.competitor_id}</span>
                </div>
                <div class="competitor-score ${comp.isScored ? 'has-score' : 'no-score'}">
                  ${comp.isScored ? comp.Total : 'Waiting'}
                </div>
              </div>
            `).join('')}
          </div>
          
          ${!isActive ? `
            <button class="btn-action" style="padding: 4px 8px; font-size: 0.75rem; margin-top: 6px; width: 100%; justify-content: center;" 
              onclick="toggleCompetitorsList('comp-list-${ringNum}-${evt.event_order}', this)">
              Show Competitors (${totalCompetitors})
            </button>
          ` : ''}
        </div>
      `;
    });
    
    cardHTML += `</div>`;
    card.innerHTML = cardHTML;
    container.appendChild(card);
  });
}

function toggleCompetitorsList(id, button) {
  const list = document.getElementById(id);
  if (!list) return;
  
  if (list.style.display === 'none') {
    list.style.display = 'flex';
    button.textContent = 'Hide Competitors';
  } else {
    list.style.display = 'none';
    const count = list.children.length;
    button.textContent = `Show Competitors (${count})`;
  }
}

// ==========================================
// 2. LEADERBOARD VIEW LOGIC
// ==========================================

function updateLeaderboard() {
  const container = document.getElementById('leaderboard-grid');
  if (!container) return;
  
  const divFilter = document.getElementById('filter-division').value;
  const evtFilter = document.getElementById('filter-event').value;
  
  container.innerHTML = '';
  
  // Group scored competitors by division_code + event_code
  const groupings = {};
  
  appState.competitors.forEach(comp => {
    // Apply filters
    if (divFilter !== 'all' && comp.division_code !== divFilter) return;
    if (evtFilter !== 'all' && comp.event_code !== evtFilter) return;
    
    // We only rank scored competitors OR show all competitors registered.
    // Leaderboard is generally for completed scores. Let's include all but sort unscored at the bottom.
    const groupKey = `${comp.division_code}__${comp.event_code}`;
    
    if (!groupings[groupKey]) {
      groupings[groupKey] = {
        division_code: comp.division_code,
        event_code: comp.event_code,
        event_name: comp.event_name,
        competitors: []
      };
    }
    groupings[groupKey].competitors.push(comp);
  });
  
  const groupsArray = Object.values(groupings);
  
  // Sort groups by Division code then Event code
  groupsArray.sort((a, b) => {
    const divComp = a.division_code.localeCompare(b.division_code);
    if (divComp !== 0) return divComp;
    return a.event_code.localeCompare(b.event_code);
  });
  
  if (groupsArray.length === 0) {
    container.innerHTML = `
      <div class="state-container" style="grid-column: 1 / -1;">
        <h3 class="state-title">No Matching Results</h3>
        <p>No competitors or scores match the selected filters.</p>
      </div>
    `;
    return;
  }
  
  groupsArray.forEach(group => {
    // Sort competitors by Score descending
    group.competitors.sort((a, b) => {
      if (a.isScored && b.isScored) {
        return b.scoreValue - a.scoreValue;
      }
      if (a.isScored) return -1;
      if (b.isScored) return 1;
      return a.competitor_name.localeCompare(b.competitor_name);
    });
    
    const isEventFinalized = group.competitors.every(c => c.isScored);
    
    const card = document.createElement('div');
    card.className = 'leaderboard-card';
    
    let rowsHTML = '';
    group.competitors.forEach((comp, index) => {
      let rankText = index + 1;
      let rankClass = '';
      
      // Styling for top 3 (only if finalized)
      if (comp.isScored) {
        if (isEventFinalized) {
          if (index === 0) { rankText = '🥇'; rankClass = 'rank-1'; }
          else if (index === 1) { rankText = '🥈'; rankClass = 'rank-2'; }
          else if (index === 2) { rankText = '🥉'; rankClass = 'rank-3'; }
        } else {
          rankText = index + 1;
        }
      } else {
        rankText = '-';
      }
      
      rowsHTML += `
        <tr>
          <td class="rank-col ${rankClass}">${rankText}</td>
          <td>
            <div style="font-weight: 600;">${comp.competitor_name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">ID: #${comp.competitor_id}</div>
          </td>
          <td class="score-col">${comp.isScored ? comp.Total : 'No Score'}</td>
        </tr>
      `;
    });
    
    card.innerHTML = `
      <div class="leaderboard-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h4 class="leaderboard-event-name">${group.event_code} - ${group.event_name}</h4>
          <div class="leaderboard-division">${group.division_code}</div>
        </div>
        <span class="status-badge ${isEventFinalized ? 'status-completed-badge' : 'status-waiting-badge'}" style="margin-top: 4px;">
          ${isEventFinalized ? 'Finalized' : 'Pending'}
        </span>
      </div>
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th class="rank-col">Rank</th>
            <th>Competitor</th>
            <th class="score-col">Score</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>
    `;
    
    container.appendChild(card);
  });
}

// ==========================================
// 3. SEARCH & COMPETITOR DETAILS LOGIC
// ==========================================

function handleGlobalSearch(val) {
  appState.searchQuery = val.trim().toLowerCase();
  
  // If user is searching, automatically redirect/swap to the search tab view
  if (appState.searchQuery && appState.currentView !== 'search') {
    switchView('search');
  } else {
    renderSearchResults();
  }
}

function renderSearchResults() {
  const container = document.getElementById('search-results');
  if (!container) return;
  
  if (!appState.searchQuery) {
    container.innerHTML = `
      <div class="state-container" style="padding: 2rem 0;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); margin-bottom: 1rem;">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3 class="state-title">Find Competitor Details</h3>
        <p>Type in the search bar above to look up scores, ring schedule, and competitor details.</p>
      </div>
    `;
    return;
  }
  
  // Find matching rows
  const query = appState.searchQuery;
  const matches = appState.competitors.filter(c => {
    return c.competitor_name.toLowerCase().includes(query) || 
           c.competitor_id.toString().includes(query);
  });
  
  // Group matches by unique competitor name + id
  const groupedMatches = {};
  matches.forEach(item => {
    const key = `${item.competitor_name}__${item.competitor_id}`;
    if (!groupedMatches[key]) {
      groupedMatches[key] = {
        name: item.competitor_name,
        id: item.competitor_id,
        events: []
      };
    }
    groupedMatches[key].events.push(item);
  });
  
  const competitorsArray = Object.values(groupedMatches);
  
  if (competitorsArray.length === 0) {
    container.innerHTML = `
      <div class="state-container" style="padding: 2rem 0;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <h3 class="state-title">No Competitors Found</h3>
        <p>We couldn't find anyone matching "${appState.searchQuery}"</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  competitorsArray.forEach(comp => {
    const card = document.createElement('div');
    card.className = 'search-result-card';
    
    // Sort events by order
    comp.events.sort((a, b) => a.event_order - b.event_order);
    
    let eventsHTML = '';
    comp.events.forEach(evt => {
      eventsHTML += `
        <div class="competitor-event-card">
          <div class="competitor-event-details">
            <div class="competitor-event-label">${evt.event_code} - ${evt.event_name}</div>
            <div class="competitor-event-ring">
              Ring ${evt.ring_number} &bull; Order #${evt.event_order} &bull; ${evt.division_code}
            </div>
          </div>
          <div class="competitor-event-score-box">
            <span class="status-badge ${evt.isScored ? 'status-completed-badge' : 'status-waiting-badge'}">
              ${evt.isScored ? 'Completed' : 'Waiting'}
            </span>
            <span style="font-size: 1.1rem; font-weight: 700; color: var(--accent-amber);">
              ${evt.isScored ? evt.Total : '-'}
            </span>
          </div>
        </div>
      `;
    });
    
    card.innerHTML = `
      <div class="search-result-title">
        <span>${comp.name}</span>
        <span style="color: var(--accent-gold); font-size: 1.1rem; font-weight: 600;">ID: #${comp.id}</span>
      </div>
      <div class="competitor-meta-info">
        <span>Total Events: ${comp.events.length}</span>
        <span>Scored: ${comp.events.filter(e => e.isScored).length}/${comp.events.length}</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${eventsHTML}
      </div>
    `;
    
    container.appendChild(card);
  });
}

// ==========================================
// 4. ANNOUNCEMENTS & NEWS LOGIC
// ==========================================

function updateTicker() {
  const ticker = document.getElementById('announcement-ticker');
  if (ticker && appState.news && appState.news.length > 0) {
    const tickerText = appState.news.map(n => `${n.title}: ${n.content}`).join('   ★   ');
    ticker.textContent = tickerText;
  }
}

function renderNews() {
  const container = document.getElementById('news-grid');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!appState.news || appState.news.length === 0) {
    container.innerHTML = `
      <div class="state-container">
        <h3 class="state-title">No Announcements</h3>
        <p>There are no announcements posted at this time.</p>
      </div>
    `;
    return;
  }
  
  appState.news.forEach(item => {
    const card = document.createElement('div');
    card.className = 'news-card';
    card.innerHTML = `
      <div class="news-card-header">
        <h4 class="news-card-title">${item.title}</h4>
        <span class="news-card-date">${item.date}</span>
      </div>
      <div class="news-card-body">
        <p>${item.content}</p>
      </div>
    `;
    container.appendChild(card);
  });
}

// ==========================================
// TOUCH SWIPE NAVIGATION FOR MOBILE
// ==========================================

function initSwipeNavigation() {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  
  const minSwipeDistance = 60; // minimum horizontal distance in px to count as a swipe
  const maxVerticalDeviation = 35; // maximum vertical deviation in px to prevent diagonal swipes
  
  const viewsOrder = ['news', 'rings', 'leaderboard', 'search'];
  
  window.addEventListener('touchstart', (e) => {
    // Avoid interfering with inputs, select dropdowns, or elements that need default touch behaviors
    const targetTagName = e.target.tagName.toLowerCase();
    if (targetTagName === 'input' || targetTagName === 'select' || e.target.closest('.ring-selector') || e.target.closest('.select-filter')) {
      return;
    }
    
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });
  
  window.addEventListener('touchend', (e) => {
    const targetTagName = e.target.tagName.toLowerCase();
    if (targetTagName === 'input' || targetTagName === 'select' || e.target.closest('.ring-selector') || e.target.closest('.select-filter')) {
      return;
    }
    
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    
    handleSwipe();
  }, { passive: true });
  
  function handleSwipe() {
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    
    // Check if swipe is horizontal and meets threshold
    if (Math.abs(diffX) > minSwipeDistance && Math.abs(diffY) < maxVerticalDeviation) {
      const currentIdx = viewsOrder.indexOf(appState.currentView);
      if (currentIdx === -1) return;
      
      if (diffX < 0) {
        // Swipe Left -> Go to Next Tab
        if (currentIdx < viewsOrder.length - 1) {
          const nextView = viewsOrder[currentIdx + 1];
          switchView(nextView);
          window.location.hash = nextView;
        }
      } else {
        // Swipe Right -> Go to Previous Tab
        if (currentIdx > 0) {
          const prevView = viewsOrder[currentIdx - 1];
          switchView(prevView);
          window.location.hash = prevView;
        }
      }
    }
  }
}

// ==========================================
// AUTO REFRESH LOOP & ROUTING
// ==========================================

function startAutoRefresh() {
  // Clear any existing timer
  if (appState.refreshIntervalId) {
    clearInterval(appState.refreshIntervalId);
  }
  
  // Set 30-second interval
  appState.refreshIntervalId = setInterval(() => {
    loadData(true); // silent reload
  }, 30000);
}

// Initial App Entrypoint
window.addEventListener('DOMContentLoaded', () => {
  // Simple Hash Routing support
  const handleHashRouting = () => {
    const hash = window.location.hash.substring(1);
    if (hash === 'rings' || hash === 'leaderboard' || hash === 'search' || hash === 'news') {
      switchView(hash);
    } else {
      switchView('news');
    }
  };
  
  // Trigger initial data load
  loadData(false);
  startAutoRefresh();
  
  // Initialize swipe gestures for mobile
  initSwipeNavigation();
  
  // Monitor routing hash changes
  window.addEventListener('hashchange', handleHashRouting);
});
