const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');
const portsGrid = document.getElementById('ports-grid');
const userPortsCount = document.getElementById('user-ports-count');
const systemPortsCount = document.getElementById('system-ports-count');
const toastContainer = document.getElementById('toast-container');

let currentPorts = [];

async function loadPorts(silent = false) {
    if (!silent) {
        refreshBtn.classList.add('spinning');
        portsGrid.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Scanning active network ports...</p>
        </div>
    `;
    }

    try {
        currentPorts = await window.electronAPI.getPorts();
        if (currentPorts.error) {
            if (!silent) showToast('Failed to load ports: ' + currentPorts.error, 'error');
            portsGrid.innerHTML = '<div class="empty-state">Failed to load active ports.</div>';
        } else {
            renderPorts(currentPorts);
        }
    } catch (err) {
        if (!silent) showToast('An error occurred during scan.', 'error');
        console.error(err);
    } finally {
        if (!silent) refreshBtn.classList.remove('spinning');
    }
}

function renderPorts(ports) {

    portsGrid.innerHTML = '';

    let userCount = 0;
    let sysCount = 0;

    const searchTerm = searchInput.value.toLowerCase();

    const filtered = ports.filter(port => {
        return port.Port.toString().includes(searchTerm) ||
            (port.Name && port.Name.toLowerCase().includes(searchTerm));
    });

    if (filtered.length === 0) {
        portsGrid.innerHTML = '<div class="empty-state">No matching ports currently active.</div>';
    } else {
        filtered.forEach((port, index) => {
            if (port.IsSystem) sysCount++;
            else userCount++;

            const card = document.createElement('div');
            card.className = `port-card ${port.IsSystem ? 'system-card' : ''}`;

            card.style.animationDelay = `${(index % 10) * 0.05}s`;

            card.innerHTML = `
        <div class="card-top">
          <div class="port-number">:${port.Port}</div>
          <div class="port-status">${port.IsSystem ? 'Protected' : 'Active'}</div>
        </div>
        <div class="card-details">
          <div class="process-name">${port.Name || 'Unknown Process'}</div>
          <div class="process-pid">PID: ${port.PID}</div>
        </div>
        <div class="card-actions">
          ${port.IsSystem
                    ? `<div class="system-warning">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                 System Service
               </div>`
                    : `<button class="terminate-btn" onclick="terminateProcess(${port.PID}, ${port.Port})">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                 Terminate
               </button>`
                }
        </div>
      `;
            portsGrid.appendChild(card);
        });
    }


    if (!searchTerm) {
        userPortsCount.textContent = ports.filter(p => !p.IsSystem).length;
        systemPortsCount.textContent = ports.filter(p => p.IsSystem).length;
    }
}

async function terminateProcess(pid, portNumber) {
    try {
        const res = await window.electronAPI.killProcess(pid);
        if (res.success) {
            showToast('Successfully freed port :' + portNumber, 'success');
            loadPorts(true); // reload silently
        } else {
            showToast('Taskkill locked: ' + res.message, 'error');
        }
    } catch (err) {
        showToast('Error executing termination.', 'error');
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;


    const iconHtml = type === 'success'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

    toast.innerHTML = `${iconHtml} <span>${message}</span>`;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 3500);
}


refreshBtn.addEventListener('click', () => loadPorts());
searchInput.addEventListener('input', () => renderPorts(currentPorts));


setInterval(() => {
    if (!searchInput.value) {
        loadPorts(true);
    }
}, 10000);


loadPorts();

window.terminateProcess = terminateProcess;
