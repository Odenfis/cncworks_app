document.addEventListener('DOMContentLoaded', () => {
    // Verificamos autenticación
    if (checkAuth()) {
        // Forzado de carga dashboard
        showPage('dashboard');
    }
});

function checkAuth() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return false;
    }
    // Nombre en la topbar
    const badge = document.getElementById('userBadge');
    if (badge) {
        badge.textContent = `${user.nombre.toUpperCase()} | ${user.rol}`;
    }
    return true;
}

async function loadDashboardStats() {
    const res = await fetch('/api/dashboard/stats');
    const data = await res.json();
    document.getElementById('kpi-orders').textContent = data.activeOrders;
    document.getElementById('kpi-revenue').textContent = `$${data.revenueMTD.toLocaleString()}`;
    document.getElementById('kpi-stock').textContent = data.stockAlerts;
}

async function loadActiveOrders() {
    const res = await fetch('/api/dashboard/active-orders');
    const orders = await res.json();
    const container = document.getElementById('table-orders');
    container.innerHTML = orders.map(o => `
        <tr>
            <td style="font-family: 'IBM Plex Mono'; font-weight:600;">${o.numero}</td>
            <td>${o.cliente}</td>
            <td style="font-size:11px; color:var(--muted);">${o.descripcion}</td>
            <td>${new Date(o.fecha_entrega_plan).toLocaleDateString()}</td>
            <td>
                <div class="prog-bg"><div class="prog-fill" style="width:${o.avance_pct}%"></div></div>
            </td>
            <td><span class="pill ${o.avance_pct > 80 ? 'done' : 'prog'}">${o.estado}</span></td>
        </tr>
    `).join('');
}

async function loadMachineStatus() {
    const res = await fetch('/api/dashboard/machines');
    const machines = await res.json();
    const container = document.getElementById('machine-list');
    container.innerHTML = machines.map(m => `
        <div style="background:var(--surface); padding:10px; border-radius:4px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="font-size:11px; font-weight:600;">${m.nombre}</span>
                <span style="font-size:10px; color:${m.estado === 'Operativo' ? 'var(--accent3)' : 'var(--red)'};">● ${m.estado}</span>
            </div>
            <div style="font-size:10px; color:var(--muted);">WO Actual: ${m.wo_actual || 'Ninguna'}</div>
            <div style="font-size:10px; color:var(--accent); margin-top:4px;">Uso Mes: ${m.utilizacion_mes_pct}%</div>
        </div>
    `).join('');
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// showPage (importante)
function showPage(pageKey) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    if (pageKey === 'dashboard') {
        document.getElementById('pg-dashboard').style.display = 'block';
        document.getElementById('nav-dashboard').classList.add('active');
        loadDashboardStats(); loadActiveOrders(); loadMachineStatus();
    } else if (pageKey === 'production') {
        document.getElementById('pg-production').style.display = 'block';
        document.getElementById('nav-production').classList.add('active');
        loadProductionData();
    } else if (pageKey === 'machines') {
        document.getElementById('pg-machines').style.display = 'block';
        document.getElementById('nav-machines').classList.add('active');
        loadMachinesFullData();
    } else if (pageKey === 'inventory') {
        document.getElementById('pg-inventory').style.display = 'block';
        document.getElementById('nav-inventory').classList.add('active');
        loadInventoryData();
    } else if (pageKey === 'sales') {
        document.getElementById('pg-sales').style.display = 'block';
        document.getElementById('nav-sales').classList.add('active');
        loadSalesData();
    } else if (pageKey === 'clients') {
        document.getElementById('pg-clients').style.display = 'block';
        document.getElementById('nav-clients').classList.add('active');
        loadClientsData();
    } else if (pageKey === 'purchases') { // <-- Nuevo
        document.getElementById('pg-purchases').style.display = 'block';
        document.getElementById('nav-purchases').classList.add('active');
        loadPurchasesData();
    } else if (pageKey === 'suppliers') { // <-- Nuevo
        document.getElementById('pg-suppliers').style.display = 'block';
        document.getElementById('nav-suppliers').classList.add('active');
        loadSuppliersData();
    }
}

// Cargar datos específicos de Producción
async function loadProductionData() {
    try {
        // Cargar KPIs
        const resKpi = await fetch('/api/production/kpis');
        const kpis = await resKpi.json();
        document.getElementById('prod-kpi-total').textContent = kpis.totalMes;
        document.getElementById('prod-kpi-ontime').textContent = kpis.aTiempo;
        document.getElementById('prod-kpi-active').textContent = kpis.activas;
        document.getElementById('prod-kpi-blocked').textContent = kpis.bloqueadas;

        // Cargar Tabla
        const resTable = await fetch('/api/production/list');
        const list = await resTable.json();
        const tbody = document.getElementById('prod-table-body');

        tbody.innerHTML = list.map(o => `
            <tr>
                <td style="font-family:'IBM Plex Mono'; font-weight:600;">${o.numero}</td>
                <td>${o.cliente}</td>
                <td>${o.descripcion}</td>
                <td>${o.cantidad} ${o.unidad}</td>
                <td>${o.material_codigo}</td>
                <td><span style="font-size:11px;">${o.maquina || 'No asignada'}</span></td>
                <td>${new Date(o.fecha_entrega_plan).toLocaleDateString()}</td>
                <td>
                    <div class="prog-bg"><div class="prog-fill" style="width:${o.avance_pct}%"></div></div>
                </td>
                <td><span class="pill ${getStatusClass(o.estado)}">${o.estado}</span></td>
            </tr>
        `).join('');
    } catch (err) { console.error("Error cargando producción:", err); }
}

// Auxiliar para colores de status
function getStatusClass(status) {
    if (status === 'Entregada' || status === 'QC') return 'done';
    if (status === 'En Proceso' || status === 'Programada') return 'prog';
    if (status === 'Bloqueada' || status === 'Pendiente Mat') return 'hold'; // hold debe estar en CSS
    return '';
}

// Cargar Datos de Maquinas
async function loadMachinesFullData() {
    try {
        const res = await fetch('/api/machines/list');
        const machines = await res.json();

        const grid = document.getElementById('machines-status-grid');
        const tbody = document.getElementById('machines-table-body');

        // Renderizar Cards de Estado
        grid.innerHTML = machines.map(m => `
            <div class="panel" style="padding:15px; border-left: 4px solid ${m.estado === 'Operativo' ? 'var(--accent3)' : 'var(--red)'}">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <div style="font-size:10px; color:var(--muted); font-family:'IBM Plex Mono';">${m.codigo}</div>
                        <div style="font-weight:600; font-size:14px; margin-bottom:5px;">${m.nombre}</div>
                    </div>
                    <span class="pill ${m.estado === 'Operativo' ? 'done' : 'hold'}">${m.estado.toUpperCase()}</span>
                </div>
                <div style="margin-top:10px; font-size:12px;">
                    <div style="color:var(--muted);">Orden Actual: <span style="color:var(--text)">${m.wo_actual || 'Disponible'}</span></div>
                    <div style="margin-top:8px;">Utilización Mes: ${m.utilizacion_mes_pct}%</div>
                    <div class="prog-bg" style="margin-top:4px;"><div class="prog-fill" style="width:${m.utilizacion_mes_pct}%; background:var(--accent2);"></div></div>
                </div>
            </div>
        `).join('');

        // Renderizar Tabla Tecnica
        tbody.innerHTML = machines.map(m => {
            const daysToMaint = Math.floor((new Date(m.proximo_mantenimiento) - new Date()) / (1000 * 60 * 60 * 24));
            const maintStyle = daysToMaint < 10 ? `color:var(--red); font-weight:600;` : ``;

            return `
                <tr>
                    <td style="font-family:'IBM Plex Mono'; font-weight:600;">${m.codigo}</td>
                    <td>${m.fabricante} ${m.modelo}</td>
                    <td style="font-size:11px; color:var(--muted); max-width:200px;">${m.capacidad_desc}</td>
                    <td>$${m.costo_hora}/hr</td>
                    <td>${new Date(m.ultimo_mantenimiento).toLocaleDateString()}</td>
                    <td style="${maintStyle}">${new Date(m.proximo_mantenimiento).toLocaleDateString()}</td>
                    <td>${m.utilizacion_mes_pct}%</td>
                </tr>
            `;
        }).join('');

    } catch (err) { console.error("Error cargando máquinas:", err); }
}

// Función para cargar Inventario
async function loadInventoryData() {
    try {
        // Cargar KPIs
        const resStats = await fetch('/api/inventory/stats');
        const stats = await resStats.json();
        document.getElementById('inv-kpi-skus').textContent = stats.totalSKUs;
        document.getElementById('inv-kpi-value').textContent = `$${stats.valorTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        document.getElementById('inv-kpi-low').textContent = stats.bajoMinimo;
        document.getElementById('inv-kpi-out').textContent = stats.agotado;

        // Cargar Tabla
        const resList = await fetch('/api/inventory/list');
        const materials = await resList.json();
        const tbody = document.getElementById('inventory-table-body');

        tbody.innerHTML = materials.map(m => {
            let statusClass = 'done';
            let statusText = 'OK';

            if (m.stock_actual <= 0) {
                statusClass = 'hold'; // Rojo
                statusText = 'SIN STOCK';
            } else if (m.stock_actual <= m.stock_minimo) {
                statusClass = 'prog'; // Ambar
                statusText = 'BAJO MÍNIMO';
            }

            return `
                <tr>
                    <td style="font-family:'IBM Plex Mono'; font-weight:600;">${m.codigo}</td>
                    <td>${m.descripcion}</td>
                    <td><span style="font-size:10px; color:var(--muted);">${m.categoria}</span></td>
                    <td style="font-family:'IBM Plex Mono';">${m.ubicacion_almacen || '---'}</td>
                    <td style="font-weight:600;">${m.stock_actual} ${m.unidad_medida}</td>
                    <td style="color:var(--muted);">${m.stock_minimo}</td>
                    <td>$${m.costo_unitario.toFixed(2)}</td>
                    <td><span class="pill ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        }).join('');
    } catch (err) { console.error("Error cargando inventario:", err); }
}

async function loadSalesData() {
    try {
        const resStats = await fetch('/api/sales/stats');
        const stats = await resStats.json();
        document.getElementById('sales-kpi-rev').textContent = `$${(stats.revenueMTD || 0).toLocaleString()}`;
        document.getElementById('sales-kpi-quotes').textContent = stats.quotesOpen;
        document.getElementById('sales-kpi-ar').textContent = `$${(stats.accountsReceivable || 0).toLocaleString()}`;

        const resQuotes = await fetch('/api/sales/quotes');
        const quotes = await resQuotes.json();
        document.getElementById('sales-table-quotes').innerHTML = quotes.map(q => `
            <tr>
                <td style="font-family:'IBM Plex Mono'; font-weight:600;">${q.numero}</td>
                <td>${q.cliente}</td>
                <td style="font-size:11px; color:var(--muted);">${q.descripcion}</td>
                <td>$${q.total.toLocaleString()}</td>
                <td>${new Date(q.fecha_emision).toLocaleDateString()}</td>
                <td><span class="pill ${q.estado === 'Aprobada' ? 'done' : 'prog'}">${q.estado}</span></td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

async function loadClientsData() {
    try {
        const res = await fetch('/api/sales/clients');
        const clients = await res.json();
        document.getElementById('clients-table-body').innerHTML = clients.map(c => `
            <tr>
                <td style="font-weight:600;">${c.razon_social}</td>
                <td style="font-size:11px;">${c.nombre_contacto}<br><span style="color:var(--muted)">${c.email}</span></td>
                <td>${c.ciudad}</td>
                <td><span class="pill prog">${c.condicion_pago}</span></td>
                <td style="color:var(--accent)">${'★'.repeat(c.rating || 0)}</td>
                <td style="font-size:10px; color:var(--muted); max-width:200px;">${c.notas || ''}</td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

// Cargar Datos de Compras
async function loadPurchasesData() {
    try {
        const resStats = await fetch('/api/purchases/stats');
        const stats = await resStats.json();
        document.getElementById('purch-kpi-open').textContent = stats.openPOs;
        document.getElementById('purch-kpi-spent').textContent = `$${(stats.spentMTD || 0).toLocaleString()}`;
        document.getElementById('purch-kpi-ap').textContent = `$${(stats.accountsPayable || 0).toLocaleString()}`;

        const resList = await fetch('/api/purchases/list');
        const pos = await resList.json();
        document.getElementById('purchases-table-body').innerHTML = pos.map(p => `
            <tr>
                <td style="font-family:'IBM Plex Mono'; font-weight:600;">${p.numero} ${p.urgente ? '⚠️' : ''}</td>
                <td>${p.proveedor}</td>
                <td>${new Date(p.fecha_emision).toLocaleDateString()}</td>
                <td style="color:${new Date(p.fecha_requerida) < new Date() ? 'var(--red)' : 'var(--text)'}">
                    ${new Date(p.fecha_requerida).toLocaleDateString()}
                </td>
                <td>$${p.total.toLocaleString()}</td>
                <td><span class="pill ${p.estado === 'Recibida' ? 'done' : 'prog'}">${p.estado}</span></td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

// Cargar Datos de Proveedores
async function loadSuppliersData() {
    try {
        const res = await fetch('/api/suppliers/list');
        const suppliers = await res.json();
        document.getElementById('suppliers-table-body').innerHTML = suppliers.map(s => `
            <tr>
                <td style="font-weight:600;">${s.razon_social}</td>
                <td><span style="font-size:10px; color:var(--muted)">${s.categoria}</span></td>
                <td style="font-size:11px;">${s.nombre_contacto}<br><span style="color:var(--muted)">${s.email}</span></td>
                <td><div class="prog-bg"><div class="prog-fill" style="width:${s.on_time_pct}%; background:var(--accent3);"></div></div> ${s.on_time_pct}%</td>
                <td style="color:var(--accent)">${'★'.repeat(s.rating || 0)}</td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}