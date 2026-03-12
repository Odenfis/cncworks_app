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
    } else if (pageKey === 'finance') {
        document.getElementById('pg-finance').style.display = 'block';
        document.getElementById('nav-finance').classList.add('active');
        loadFinanceData();
    } else if (pageKey === 'cashflow') {
        document.getElementById('pg-cashflow').style.display = 'block';
        document.getElementById('nav-cashflow').classList.add('active');
        loadCashflowData();
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
                <td>
            <button class="btn-primary" style="padding:2px 6px; background:var(--accent2); font-size:10px;" 
                onclick="generateJobTraveler('${o.numero}', '${o.cliente}', '${o.descripcion}', '${o.cantidad} ${o.unidad}', '${o.material_codigo}', '${o.maquina || 'N/A'}')">
                📄
            </button>
        </td>
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

        document.getElementById('purchases-table-body').innerHTML = pos.map(p => {
            // Solo mostramos el botón si el estado es diferente a 'Recibida'
            const actionBtn = p.estado !== 'Recibida'
                ? `<button class="btn-primary" style="padding:2px 8px; font-size:10px; background:var(--accent3);" 
                    onclick="processReceipt(${p.id}, '${p.numero}')">RECIBIR</button>`
                : `<span style="color:var(--muted); font-size:10px;">Completado</span>`;
            return `
                <tr>
                    <td style="font-family:'IBM Plex Mono'; font-weight:600;">${p.numero}</td>
                    <td>${p.proveedor}</td>
                    <td>${new Date(p.fecha_emision).toLocaleDateString()}</td>
                    <td>${new Date(p.fecha_requerida).toLocaleDateString()}</td>
                    <td>$${p.total.toLocaleString()}</td>
                    <td><span class="pill ${p.estado === 'Recibida' ? 'done' : 'prog'}">${p.estado}</span></td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        }).join('');

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

//--------MODALES
// ABRIR MODAL
async function openModal(type) {
    const overlay = document.getElementById('modalOverlay');
    const fields = document.getElementById('formFields');
    overlay.style.display = 'flex';

    if (type === 'production') {
        document.getElementById('modalTitle').textContent = 'NUEVA ORDEN DE TRABAJO (WO)';
        const clients = await (await fetch('/api/helpers/clients')).json();
        const machines = await (await fetch('/api/helpers/machines')).json();

        fields.innerHTML = `
            <div class="form-group"><label>NÚMERO WO</label><input type="text" id="wo_num" placeholder="Ej: WO-3000" required></div>
            <div class="form-group"><label>CLIENTE</label>
                <select id="wo_client">${clients.map(c => `<option value="${c.id}">${c.razon_social}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>DESCRIPCIÓN</label><input type="text" id="wo_desc" required></div>
            <div class="form-group"><label>CANTIDAD</label><input type="number" id="wo_qty" required></div>
            <div class="form-group"><label>FECHA ENTREGA</label><input type="date" id="wo_date" required></div>
            <div class="form-group"><label>MÁQUINA PRINCIPAL</label>
                <select id="wo_machine">${machines.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}</select>
            </div>
            <input type="hidden" id="formType" value="production">
        `;
    } else if (type === 'client') {
        document.getElementById('modalTitle').textContent = 'NUEVO CLIENTE';
        fields.innerHTML = `
            <div class="form-group"><label>RAZÓN SOCIAL</label><input type="text" id="c_rs" required></div>
            <div class="form-group"><label>CONTACTO</label><input type="text" id="c_co" required></div>
            <div class="form-group"><label>EMAIL</label><input type="email" id="c_em" required></div>
            <div class="form-group"><label>TELÉFONO</label><input type="text" id="c_te"></div>
            <div class="form-group"><label>CIUDAD</label><input type="text" id="c_ci"></div>
            <input type="hidden" id="formType" value="client">
        `;
    } else if (type === 'inventory') {
        document.getElementById('modalTitle').textContent = 'NUEVO MATERIAL / SKU';
        const cats = await (await fetch('/api/helpers/categories')).json();
        fields.innerHTML = `
            <div class="form-group"><label>CÓDIGO / SKU</label><input type="text" id="m_cod" required></div>
            <div class="form-group"><label>DESCRIPCIÓN</label><input type="text" id="m_des" required></div>
            <div class="form-group"><label>CATEGORÍA</label>
                <select id="m_cat">${cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>UNIDAD (lbs, pcs, gal)</label><input type="text" id="m_uni" required></div>
            <div class="form-group"><label>COSTO UNITARIO</label><input type="number" step="0.0001" id="m_cos" required></div>
            <div class="form-group"><label>STOCK MÍNIMO</label><input type="number" id="m_min" required></div>
            <div class="form-group"><label>UBICACIÓN (Rack/Bin)</label><input type="text" id="m_ubi"></div>
            <input type="hidden" id="formType" value="inventory">
        `;
    } else if (type === 'purchase') {
        document.getElementById('modalTitle').textContent = 'NUEVA ÓRDEN DE COMPRA (PO)';
        const materials = await (await fetch('/api/inventory/list')).json();
        const suppliers = await (await fetch('/api/helpers/suppliers')).json();
        fields.innerHTML = `            
            <div class="form-group"><label>MATERIAL A COMPRAR</label>
                <select id="po_mat">${materials.map(m => `<option value="${m.id}">${m.descripcion}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>CANTIDAD</label><input type="number" id="po_qty" required></div>
            <div class="form-group"><label>NÚMERO PO</label><input type="text" id="po_num" placeholder="PO-0000" required></div>
            <div class="form-group"><label>PROVEEDOR</label>
                <select id="po_sup">${suppliers.map(s => `<option value="${s.id}">${s.razon_social}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>FECHA REQUERIDA</label><input type="date" id="po_date" required></div>
            <div class="form-group"><label>TOTAL ESTIMADO (USD)</label><input type="number" step="0.01" id="po_tot" required></div>
            <div class="form-group"><label>NOTAS / REFERENCIA</label><textarea id="po_not"></textarea></div>
            <input type="hidden" id="formType" value="purchase">
        `;
    }
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}

// GUARDAR REGISTRO
document.getElementById('dynamicForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('formType').value;
    let payload = {};
    let endpoint = '';

    if (type === 'production') {
        endpoint = '/api/create/work-order';
        payload = {
            numero: document.getElementById('wo_num').value,
            cliente_id: document.getElementById('wo_client').value,
            descripcion: document.getElementById('wo_desc').value,
            cantidad: document.getElementById('wo_qty').value,
            fecha_entrega_plan: document.getElementById('wo_date').value,
            estacion_id: document.getElementById('wo_machine').value
        };
    } else if (type === 'client') {
        endpoint = '/api/create/client';
        payload = {
            razon_social: document.getElementById('c_rs').value,
            contacto: document.getElementById('c_co').value,
            email: document.getElementById('c_em').value,
            telefono: document.getElementById('c_te').value,
            ciudad: document.getElementById('c_ci').value
        };
    } else if (type === 'inventory') {
        endpoint = '/api/create/material';
        payload = {
            codigo: document.getElementById('m_cod').value,
            descripcion: document.getElementById('m_des').value,
            categoria_id: document.getElementById('m_cat').value,
            unidad: document.getElementById('m_uni').value,
            costo: document.getElementById('m_cos').value,
            stock_min: document.getElementById('m_min').value,
            ubicacion: document.getElementById('m_ubi').value
        };
    } else if (type === 'purchase') {
        endpoint = '/api/create/purchase-order';
        payload = {
            numero: document.getElementById('po_num').value,
            proveedor_id: document.getElementById('po_sup').value,
            fecha_req: document.getElementById('po_date').value,
            total: document.getElementById('po_tot').value,
            notas: document.getElementById('po_not').value,
            // AGREGADO: Estos campos son necesarios para que la PO tenga contenido que recibir
            material_id: document.getElementById('po_mat').value,
            cantidad: document.getElementById('po_qty').value
        };
    }

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
        alert('Registro guardado con éxito');
        closeModal();
        // Recargar la página actual para ver los cambios
        if (type === 'inventory') loadInventoryData();
        if (type === 'purchase') loadPurchasesData();
        if (type === 'production') loadProductionData();
        if (type === 'client') loadClientsData();
    }
});

//Funcion nueva para recepcion de PO (Ordenes de compra)
async function processReceipt(poId, poNum) {
    if (!confirm(`¿Confirmar recepción de la orden ${poNum}? El stock aumentará automáticamente.`)) return;

    try {
        const res = await fetch(`/api/purchases/receive/${poId}`, { method: 'PUT' });
        const data = await res.json();

        if (data.success) {
            alert(data.message);
            // CORRECCIÓN: Refrescar ambas tablas para que el cambio sea visible
            loadPurchasesData();
            loadInventoryData();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (e) {
        alert('Error de conexión al procesar recepción');
    }
}

// funciones financieras

async function loadFinanceData() {
    try {
        const res = await fetch('/api/finance/pl-summary');
        const data = await res.json();

        document.getElementById('fin-ingresos').textContent = `$${data.ingresos.toLocaleString()}`;
        document.getElementById('fin-egresos').textContent = `$${data.egresos.toLocaleString()}`;
        document.getElementById('fin-utilidad').textContent = `$${(data.ingresos - data.egresos).toLocaleString()}`;
        document.getElementById('fin-ar').textContent = `$${data.porCobrar.toLocaleString()}`;
        document.getElementById('fin-ap').textContent = `$${data.porPagar.toLocaleString()}`;
    } catch (e) { console.error(e); }
}

async function loadCashflowData() {
    try {
        // Cargar Cuentas
        const resBanks = await fetch('/api/finance/bank-accounts');
        const banks = await resBanks.json();
        document.getElementById('bank-accounts-grid').innerHTML = banks.map(b => `
            <div class="panel" style="padding:15px; border-top: 3px solid ${b.saldo_actual >= 0 ? 'var(--accent3)' : 'var(--red)'}">
                <div style="font-size:10px; color:var(--muted);">${b.banco} (${b.ultimos4})</div>
                <div style="font-weight:600; margin:5px 0;">${b.nombre}</div>
                <div style="font-size:20px; font-family:'IBM Plex Mono'; color:${b.saldo_actual >= 0 ? 'white' : 'var(--red)'}">
                    $${b.saldo_actual.toLocaleString()}
                </div>
            </div>
        `).join('');

        // Cargar Transacciones
        const resTrans = await fetch('/api/finance/transactions');
        const trans = await resTrans.json();
        document.getElementById('transactions-table-body').innerHTML = trans.map(t => `
            <tr>
                <td>${new Date(t.fecha).toLocaleDateString()}</td>
                <td>${t.descripcion}</td>
                <td><span style="font-size:10px; color:var(--muted);">${t.categoria}</span></td>
                <td>${t.cuenta}</td>
                <td style="color:${t.tipo === 'Ingreso' ? 'var(--accent3)' : 'var(--red)'}; font-weight:600;">
                    ${t.tipo === 'Ingreso' ? '+' : '-'}$${t.monto.toLocaleString()}
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

//funcion jobtraveler
function generateJobTraveler(wo, cliente, desc, cant, mat, maq) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const logoColor = [245, 158, 11]; // El color ambar del sistema (tema)

    // --- ENCABEZADO ---
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(245, 158, 11);
    doc.text("PQ CNC WORKS, LLC", 15, 20);

    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("JOB TRAVELER / ORDEN DE FABRICACIÓN", 15, 30);
    doc.text(`Fecha de Impresión: ${new Date().toLocaleString()}`, 130, 30);

    // --- CUERPO ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(`ORDEN DE TRABAJO: ${wo}`, 15, 55);

    // Tabla de detalles
    doc.autoTable({
        startY: 65,
        head: [['CONCEPTO', 'DETALLE']],
        body: [
            ['CLIENTE', cliente],
            ['PIEZA / DESCRIPCIÓN', desc],
            ['CANTIDAD TOTAL', cant],
            ['MATERIAL REQUERIDO', mat],
            ['ESTACIÓN PRINCIPAL', maq],
            ['ESTADO ACTUAL', 'PROGRAMADA / EN PROCESO'],
            ['FECHA COMPROMISO', 'VER SISTEMA ERP']
        ],
        headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0] },
        styles: { fontSize: 11, cellPadding: 5 }
    });

    // --- SECCIÓN DE FIRMAS E INSPECCION ---
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(12);
    doc.text("CONTROL DE CALIDAD E INSPECCIÓN:", 15, finalY);

    doc.setDrawColor(200, 200, 200);
    doc.line(15, finalY + 15, 80, finalY + 15);
    doc.line(110, finalY + 15, 185, finalY + 15);

    doc.setFontSize(9);
    doc.text("Firma Operador", 35, finalY + 20);
    doc.text("Firma Inspector Calidad", 135, finalY + 20);

    // Pie de pagina
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Documento generado automáticamente por PQ CNC ERP v1.0", 15, 285);

    // Descargar PDF
    doc.save(`JobTraveler_${wo}.pdf`);
}

// --- MODO CLARO / OSCURO ---
function toggleTheme() {
    const body = document.body;
    body.classList.toggle('light-mode');

    // Guardar preferencia
    if (body.classList.contains('light-mode')) {
        localStorage.setItem('theme', 'light');
    } else {
        localStorage.setItem('theme', 'dark');
    }
}

// Aplicar tema guardado al cargar la página
(function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }
})();