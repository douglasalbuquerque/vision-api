// server.js - Main API Server with SQLite
const express = require('express');
const Database = require('better-sqlite3');
const app = express();
const PORT = 3000;
const basicAuth = require('express-basic-auth');
const cors = require('cors');

app.use(express.json());

// Basic Auth Configuration
const basicAuthConfig = {
  users: {},
  challenge: true,
  realm: 'ERP Integration API',
  unauthorizedResponse: (req) => {
    return {
      success: false,
      message: 'Authentication required',
      timestamp: new Date().toISOString()
    };
  }
};

// Set up Basic Auth credentials from environment variables
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'pass123';

// Add credentials to basicAuth config
basicAuthConfig.users[AUTH_USERNAME] = AUTH_PASSWORD;

// Middleware
app.use(cors());
app.use(express.json());

// Apply Basic Auth to all routes except health check
app.use('/health', (req, res, next) => next()); // Skip auth for health check
app.use(basicAuth(basicAuthConfig));



// Initialize SQLite database
const db = new Database('order_management.db', { verbose: console.log });
db.pragma('foreign_keys = ON');

// Initialize database schema (run once)
function initDatabase() {
  const fs = require('fs');
  const schema = fs.readFileSync('schema.sql', 'utf8');
  db.exec(schema);
  console.log('Database initialized successfully');
}

// Uncomment on first run to initialize DB:
// initDatabase();

// =====================
// STORE ENDPOINTS
// =====================

// Create a new store
app.post('/api/stores', (req, res) => {
  try {
    const { customer_id, store_name, address, city, state, zip_code } = req.body;
    
    if (!customer_id || !store_name) {
      return res.status(400).json({ error: 'customer_id and store_name are required' });
    }

    const stmt = db.prepare(`
      INSERT INTO Store (customer_id, store_name, address, city, state, zip_code) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(customer_id, store_name, address, city, state, zip_code);

    res.status(201).json({
      message: 'Store created successfully',
      store_id: result.lastInsertRowid
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create store' });
  }
});

// Get all stores for a customer
app.get('/api/customers/:customerId/stores', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM Store WHERE customer_id = ?');
    const stores = stmt.all(req.params.customerId);
    res.json(stores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// =====================
// PART ENDPOINTS
// =====================

// Get substrates (for dropdown)
app.get('/api/substrates', (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, name FROM Substrate');
    const substrates = stmt.all();
    res.json(substrates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch substrates' });
  }
});

// Get finishes (for dropdown)
app.get('/api/finishes', (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, name FROM Finish');
    const finishes = stmt.all();
    res.json(finishes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch finishes' });
  }
});

// Create a new part
app.post('/api/parts', (req, res) => {
  try {
    const { internal_code, description, base_price, substrate_id, finish_id } = req.body;
    
    if (!internal_code || !base_price || !substrate_id || !finish_id) {
      return res.status(400).json({ 
        error: 'internal_code, base_price, substrate_id, and finish_id are required' 
      });
    }

    const stmt = db.prepare(`
      INSERT INTO Part (internal_code, description, base_price, substrate_id, finish_id) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(internal_code, description, base_price, substrate_id, finish_id);

    res.status(201).json({
      message: 'Part created successfully',
      part_id: result.lastInsertRowid
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Internal code already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create part' });
  }
});

// Get all parts with details
app.get('/api/parts', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        p.id, 
        p.internal_code, 
        p.description, 
        p.base_price,
        s.name as substrate,
        f.name as finish,
        p.created_at
      FROM Part p
      JOIN Substrate s ON p.substrate_id = s.id
      JOIN Finish f ON p.finish_id = f.id
      ORDER BY p.created_at DESC
    `);
    const parts = stmt.all();
    res.json(parts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch parts' });
  }
});

// Get single part with mappings
app.get('/api/parts/:partId', (req, res) => {
  try {
    const partStmt = db.prepare(`
      SELECT 
        p.id, 
        p.internal_code, 
        p.description, 
        p.base_price,
        s.name as substrate,
        f.name as finish
      FROM Part p
      JOIN Substrate s ON p.substrate_id = s.id
      JOIN Finish f ON p.finish_id = f.id
      WHERE p.id = ?
    `);
    const part = partStmt.get(req.params.partId);

    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const mappingStmt = db.prepare(`
      SELECT 
        pm.id,
        pm.customer_code,
        pm.price_override,
        c.name as customer_name
      FROM PartMapping pm
      JOIN Customer c ON pm.customer_id = c.id
      WHERE pm.part_id = ?
    `);
    const mappings = mappingStmt.all(req.params.partId);

    res.json({
      ...part,
      customer_mappings: mappings
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch part' });
  }
});

// Update part price
app.patch('/api/parts/:partId/price', (req, res) => {
  try {
    const { base_price } = req.body;
    
    if (!base_price || base_price <= 0) {
      return res.status(400).json({ error: 'Valid base_price is required' });
    }

    const stmt = db.prepare(`
      UPDATE Part 
      SET base_price = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = stmt.run(base_price, req.params.partId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    res.json({ 
      message: 'Part price updated successfully',
      part_id: req.params.partId,
      new_price: base_price
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update part price' });
  }
});

// =====================
// PART MAPPING ENDPOINTS
// =====================

// Create part mapping for customer
app.post('/api/parts/:partId/mappings', (req, res) => {
  try {
    const { customer_id, customer_code, price_override } = req.body;
    
    if (!customer_id || !customer_code) {
      return res.status(400).json({ 
        error: 'customer_id and customer_code are required' 
      });
    }

    const stmt = db.prepare(`
      INSERT INTO PartMapping (part_id, customer_id, customer_code, price_override) 
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(req.params.partId, customer_id, customer_code, price_override);

    res.status(201).json({
      message: 'Part mapping created successfully',
      mapping_id: result.lastInsertRowid
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Customer code already exists for this customer' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create part mapping' });
  }
});

// Get parts by customer (with optional customer code filter)
app.get('/api/customers/:customerId/parts?', (req, res) => {
  try {
    const { customerId } = req.params;
    const { customerCode } = req.query;

    // If customerCode is provided, return single part
    if (customerCode) {
      const stmt = db.prepare(`
        SELECT 
          p.id,
          p.internal_code,
          pm.customer_code,
          p.description,
          COALESCE(pm.price_override, p.base_price) as price,
          s.name as substrate,
          f.name as finish
        FROM PartMapping pm
        JOIN Part p ON pm.part_id = p.id
        JOIN Substrate s ON p.substrate_id = s.id
        JOIN Finish f ON p.finish_id = f.id
        WHERE pm.customer_id = ? AND pm.customer_code = ?
      `);
      
      const part = stmt.get(customerId, customerCode);

      if (!part) {
        return res.status(404).json({ error: 'Part not found for this customer code' });
      }

      return res.json(part);
    } else {

    // If no customerCode, return all parts for this customer
    const stmt = db.prepare(`
      SELECT 
        p.id,
        p.internal_code,
        pm.customer_code,
        p.description,
        COALESCE(pm.price_override, p.base_price) as price,
        s.name as substrate,
        f.name as finish,
        pm.created_at
      FROM PartMapping pm
      JOIN Part p ON pm.part_id = p.id
      JOIN Substrate s ON p.substrate_id = s.id
      JOIN Finish f ON p.finish_id = f.id
      WHERE pm.customer_id = ?
      ORDER BY pm.created_at DESC
    `);
    
    const parts = stmt.all(customerId);
    res.json(parts);
}
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch parts' });
  }
});

// =====================
// ORDER ENDPOINTS
// =====================

// Get orders for customer
app.get('/api/customers/:customerId/orders', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        o.id,
        o.order_number,
        os.status_name,
        o.total_amount,
        o.order_date,
        COUNT(op.id) as total_parts
      FROM Orders o
      JOIN OrderStatus os ON o.status_id = os.id
      LEFT JOIN OrderPart op ON o.id = op.order_id
      WHERE o.customer_id = ?
      GROUP BY o.id
      ORDER BY o.order_date DESC
    `);
    
    const orders = stmt.all(req.params.customerId);
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order details
app.get('/api/orders/:orderId', (req, res) => {
  try {
    const orderStmt = db.prepare(`
      SELECT 
        o.id,
        o.order_number,
        os.status_name as order_status,
        o.total_amount,
        o.order_date,
        c.name as customer_name,
        c.email as customer_email
      FROM Orders o
      JOIN OrderStatus os ON o.status_id = os.id
      JOIN Customer c ON o.customer_id = c.id
      WHERE o.id = ?
    `);
    
    const order = orderStmt.get(req.params.orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const partsStmt = db.prepare(`
      SELECT 
        op.id,
        p.internal_code,
        p.description,
        op.quantity,
        op.unit_price,
        ps.status_name as part_status,
        op.notes
      FROM OrderPart op
      JOIN Part p ON op.part_id = p.id
      JOIN PartStatus ps ON op.status_id = ps.id
      WHERE op.order_id = ?
    `);
    
    const parts = partsStmt.all(req.params.orderId);

    res.json({
      ...order,
      parts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

// =====================
// UTILITY ENDPOINTS
// =====================

// Get all customers
app.get('/api/customers', (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, name, email, phone FROM Customer');
    const customers = stmt.all();
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get order statuses
app.get('/api/order-statuses', (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, status_name FROM OrderStatus');
    const statuses = stmt.all();
    res.json(statuses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch order statuses' });
  }
});

// Get part statuses
app.get('/api/part-statuses', (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, status_name FROM PartStatus');
    const statuses = stmt.all();
    res.json(statuses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch part statuses' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  console.log('Database connection closed');
  process.exit(0);
});