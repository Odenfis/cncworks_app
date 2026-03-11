const express = require('express');
const path = require('path');
const { poolPromise, sql } = require('./db');
const app = express();

app.use(express.json());
// FORZAR REDIRECCIÓN AL LOGIN AL ENTRAR A LA RAIZ
app.get('/', (req, res) => {
    res.redirect('/login.html');
});
app.use(express.static(path.join(__dirname, '../public')));

// login de la api
app.post('/api/login', async (req, res) => {
    const { email } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT nombre, email, rol FROM usuarios WHERE email = @email AND activo = 1');

        if (result.recordset.length > 0) {
            res.json({ success: true, user: result.recordset[0] });
        } else {
            res.status(401).json({ success: false, message: 'Usuario no autorizado' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API DASHBOARD DATA ---
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const pool = await poolPromise;
        // Obtenemos KPIs principales
        const ordenes = await pool.request().query("SELECT COUNT(*) as total FROM ordenes_trabajo WHERE estado NOT IN ('Entregada', 'Cancelada')");
        const revenue = await pool.request().query("SELECT SUM(total) as total FROM facturas WHERE MONTH(fecha_emision) = MONTH(GETDATE())");
        const stockAlerts = await pool.request().query("SELECT COUNT(*) as total FROM materiales WHERE stock_actual <= stock_minimo");

        res.json({
            activeOrders: ordenes.recordset[0].total,
            revenueMTD: revenue.recordset[0].total || 0,
            stockAlerts: stockAlerts.recordset[0].total
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/dashboard/active-orders', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT TOP 7 o.numero, c.razon_social as cliente, o.descripcion, o.fecha_entrega_plan, o.avance_pct, o.estado 
            FROM ordenes_trabajo o 
            JOIN clientes c ON o.cliente_id = c.id 
            WHERE o.estado NOT IN ('Entregada') 
            ORDER BY o.prioridad ASC, o.fecha_entrega_plan ASC`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/dashboard/machines', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT nombre, estado, wo_actual, utilizacion_mes_pct FROM estaciones_trabajo");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- API PRODUCCION ---
// KPIs de Produccion
app.get('/api/production/kpis', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM ordenes_trabajo WHERE MONTH(created_at) = MONTH(GETDATE())) as totalMes,
                (SELECT COUNT(*) FROM ordenes_trabajo WHERE estado = 'Entregada' AND fecha_entrega_real <= fecha_entrega_plan) as aTiempo,
                (SELECT COUNT(*) FROM ordenes_trabajo WHERE estado = 'Bloqueada') as bloqueadas,
                (SELECT COUNT(*) FROM ordenes_trabajo WHERE estado NOT IN ('Entregada', 'Cancelada')) as activas
            FROM ordenes_trabajo`);
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listado Completo de Órdenes de Trabajo
app.get('/api/production/list', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                o.numero, c.razon_social as cliente, o.descripcion, o.cantidad, o.unidad,
                o.material_codigo, e.nombre as maquina, o.fecha_inicio_plan, 
                o.fecha_entrega_plan, o.estado, o.avance_pct
            FROM ordenes_trabajo o
            JOIN clientes c ON o.cliente_id = c.id
            LEFT JOIN estaciones_trabajo e ON o.estacion_principal_id = e.id
            ORDER BY o.fecha_entrega_plan ASC`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- API MAQUINAS ---

app.get('/api/machines/list', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                id, codigo, nombre, tipo, fabricante, modelo, 
                capacidad_desc, costo_hora, estado, wo_actual, 
                utilizacion_mes_pct, ultimo_mantenimiento, proximo_mantenimiento
            FROM estaciones_trabajo
            ORDER BY codigo ASC`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- API INVENTARIO ---

// KPIs de Inventario (Total SKUs, Valor Total, Bajo Mínimo)
app.get('/api/inventory/stats', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                COUNT(*) as totalSKUs,
                SUM(stock_actual * costo_unitario) as valorTotal,
                SUM(CASE WHEN stock_actual <= stock_minimo THEN 1 ELSE 0 END) as bajoMinimo,
                SUM(CASE WHEN stock_actual = 0 THEN 1 ELSE 0 END) as agotado
            FROM materiales WHERE activo = 1`);
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listado de Materiales con su Categoría
app.get('/api/inventory/list', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                m.codigo, m.descripcion, c.nombre as categoria, 
                m.stock_actual, m.stock_minimo, m.unidad_medida, 
                m.costo_unitario, m.ubicacion_almacen
            FROM materiales m
            JOIN categorias_material c ON m.categoria_id = c.id
            WHERE m.activo = 1
            ORDER BY c.nombre, m.codigo`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- API VENTAS Y CLIENTES ---

// Estadísticas de Ventas (Revenue MTD - Cotizaciones Pendientes - Cuentas por Cobrar)
app.get('/api/sales/stats', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                (SELECT SUM(total) FROM facturas WHERE MONTH(fecha_emision) = MONTH(GETDATE())) as revenueMTD,
                (SELECT COUNT(*) FROM cotizaciones WHERE estado = 'Pendiente') as quotesOpen,
                (SELECT SUM(total) FROM cotizaciones WHERE estado = 'Pendiente') as quotesValue,
                (SELECT SUM(saldo) FROM facturas WHERE estado <> 'Pagada') as accountsReceivable
            FROM empresa WHERE id = 1`); // Usamos empresa como dummy para el SELECT
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listado de Cotizaciones
app.get('/api/sales/quotes', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT q.numero, c.razon_social as cliente, q.descripcion, q.total, q.fecha_emision, q.estado
            FROM cotizaciones q
            JOIN clientes c ON q.cliente_id = c.id
            ORDER BY q.fecha_emision DESC`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listado de Clientes
app.get('/api/sales/clients', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT razon_social, ciudad, nombre_contacto, email, condicion_pago, rating, notas
            FROM clientes ORDER BY razon_social`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- API COMPRAS Y PROVEEDORES ---
// Estadísticas de Compras (POs Abiertas, Gasto MTD, Cuentas por Pagar)
app.get('/api/purchases/stats', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM ordenes_compra WHERE estado NOT IN ('Recibida', 'Cancelada')) as openPOs,
                (SELECT SUM(total) FROM ordenes_compra WHERE MONTH(fecha_emision) = MONTH(GETDATE())) as spentMTD,
                (SELECT SUM(saldo) FROM cuentas_pagar WHERE estado <> 'Pagada') as accountsPayable
            FROM empresa WHERE id = 1`);
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listado de Ordenes de Compra
app.get('/api/purchases/list', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT oc.numero, p.razon_social as proveedor, oc.fecha_emision, oc.fecha_requerida, oc.total, oc.estado, oc.urgente
            FROM ordenes_compra oc
            JOIN proveedores p ON oc.proveedor_id = p.id
            ORDER BY oc.fecha_emision DESC`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listado de Proveedores
app.get('/api/suppliers/list', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT razon_social, categoria, nombre_contacto, email, telefono, on_time_pct, rating
            FROM proveedores ORDER BY razon_social`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

//process by odenfis
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));