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
    const { 
      customerId, 
      firstName, 
      lastName, 
      email, 
      companyName, 
      storeNumber, 
      addressLine1, 
      addressLine2,
      country,  
      city, 
      state, 
      lookupHint 
    } = req.body;
    
    // Validação dos campos obrigatórios
    if (!customerid || !storeNumber) {
      return res.status(400).json({ 
        error: 'customerid and storeNumber are required' 
      });
    }

    // Persiste apenas os campos que existem na tabela atual
    const stmt = db.prepare(`
      INSERT INTO Store (customer_id, store_name, address, city, state, zip_code) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    // Mapeamento dos novos campos para os campos existentes na tabela
    const result = stmt.run(
      customerid,           // customer_id
      companyName || '',        // store_name (usando company como nome da loja)
      addressLine1 || '',       // address
      city || '',           // city
      state || '',          // state
      lookupHint || ''          // zip_code (usando lookup como código postal)
    );

    res.status(201).json({
      message: 'Store created successfully',
      store_id: result.lastInsertRowid,
      customerid: customerid,
      storeNumber: storeNumber
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

// Get prices for multiple parts by customer and company codes
app.post('/api/prices/batch', (req, res) => {
  try {
    const { ERPId, companyId, items } = req.body;

    // Validate request
    if (!ERPId || !companyId || !items || !Array.isArray(items)) {
      return res.status(400).json({ 
        error: 'Invalid request. Required: ERPId, companyId, and items array' 
      });
    }

    // Get customer ID from code
    const customerStmt = db.prepare(`
      SELECT id FROM Customer WHERE id = ?
    `);
    const customer = customerStmt.get(companyId);

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const prices = [];

    // Process each item
    for (const item of items) {
      const { partCode, quantity } = item;

      if (!partCode || !quantity) continue;

      // First, try to find a customer-specific mapping
      const mappingStmt = db.prepare(`
        SELECT 
          p.internal_code as partCode,
          pm.customer_code as customerCode,
          COALESCE(pm.price_override, p.base_price) as price,
          p.description
        FROM PartMapping pm
        JOIN Part p ON pm.part_id = p.id
        WHERE pm.customer_code = ? 
          AND pm.customer_id = ?
      `);
      let priceInfo = mappingStmt.get(partCode, companyId);

      // If no mapping found, try to find by internal code
      if (!priceInfo) {
        const partStmt = db.prepare(`
          SELECT 
            p.internal_code as partCode,
            pm.customer_code as customerCode,
            p.base_price as price,
            p.description
          FROM Part p
          JOIN PartMapping pm
            ON p.id = pm.part_id
           WHERE p.internal_code = ? and pm.customer_id = ?
        `);
        priceInfo = partStmt.get(partCode, companyId);
      }

      if (priceInfo) {
        let finalPrice = priceInfo.price;
        
        // Apply progressive discount: 0.01% for every 10 items
        if (quantity >= 10) {
          const discountTiers = Math.floor(quantity / 10);
          const discountPercentage = discountTiers * 0.0001; // 0.01% = 0.0001
          finalPrice = priceInfo.price * (1 - discountPercentage);
        }

        prices.push({
          internalCode: priceInfo.partCode,
          customerCode: priceInfo.customerCode,
          unit_price: parseFloat(finalPrice.toFixed(2)), // Round to 4 decimal places
          total_price: parseFloat(finalPrice.toFixed(2)) * quantity,
          description: priceInfo.description
        });
      } else {
        // Optionally include items not found
        prices.push({
          partCode: partCode,
          price: null,
          description: null,
          error: 'Part not found'
        });
      }
    }

    res.json({ prices });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// Search for related part codes by description and optional customer part
app.post('/api/parts/search2', (req, res) => {
  try {
    const { ERPId, companyId, customerPart, description, size } = req.body;

    // Validate request
    if (!ERPId || !companyId || !description) {
      return res.status(400).json({ 
        error: 'Invalid request. Required: ERPId, companyId, and description' 
      });
    }

    // Get customer ID from code
    const customerStmt = db.prepare(`
      SELECT id FROM Customer WHERE id = ?
    `);
    const customer = customerStmt.get(companyId);

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const relatedCodes = [];

    // Strategy 1: If customerPart is provided, try to find exact match first
    if (customerPart) {
      const exactMatchStmt = db.prepare(`
        SELECT 
          p.internal_code as internalCode,
          pm.customer_code as customerCode,
          p.description,
          p.base_price as price,
          COALESCE(pm.price_override, p.base_price) as customerPrice,
          'exact_customer_code' as matchType
        FROM PartMapping pm
        JOIN Part p ON pm.part_id = p.id
        WHERE pm.customer_code = ? 
          AND pm.customer_id = ?
        LIMIT 1
      `);
      const exactMatch = exactMatchStmt.get(customerPart, companyId);
      
      if (exactMatch) {
        relatedCodes.push(exactMatch);
      }
    }

    // Strategy 2: Search by description for this customer
    // Using LIKE with wildcards for fuzzy matching
    const descriptionWords = description.trim().split(/\s+/).filter(w => w.length > 2);
    
    if (descriptionWords.length > 0) {
      // Build dynamic LIKE conditions for each word
      const likeConditions = descriptionWords.map(() => 
        'p.description LIKE ?'
      ).join(' AND ');
      
      const likeParams = descriptionWords.map(word => `%${word}%`);
      
      const descSearchStmt = db.prepare(`
        SELECT 
          p.internal_code as internalCode,
          pm.customer_code as customerCode,
          p.description,
          p.base_price as price,
          COALESCE(pm.price_override, p.base_price) as customerPrice,
          'description_match' as matchType
        FROM Part p
        JOIN PartMapping pm ON p.id = pm.part_id
        WHERE pm.customer_id = ?
          AND (${likeConditions})
          ${customerPart ? 'AND pm.customer_code != ?' : ''}
        ORDER BY 
          LENGTH(p.description) ASC,
          p.internal_code ASC
        LIMIT 10
      `);
      
      const params = [companyId, ...likeParams];
      if (customerPart) {
        params.push(customerPart);
      }
      
      const descMatches = descSearchStmt.all(...params);
      relatedCodes.push(...descMatches);
    }

    // Strategy 3: If size is provided, try to match parts with similar size in description
    if (size && relatedCodes.length < 5) {
      const sizeSearchStmt = db.prepare(`
        SELECT 
          p.internal_code as internalCode,
          pm.customer_code as customerCode,
          p.description,
          p.base_price as price,
          COALESCE(pm.price_override, p.base_price) as customerPrice,
          'size_match' as matchType
        FROM Part p
        JOIN PartMapping pm ON p.id = pm.part_id
        WHERE pm.customer_id = ?
          AND p.description LIKE ?
          ${customerPart ? 'AND pm.customer_code != ?' : ''}
        ORDER BY p.internal_code ASC
        LIMIT 5
      `);
      
      const sizeParams = [companyId, `%${size}%`];
      if (customerPart) {
        sizeParams.push(customerPart);
      }
      
      const sizeMatches = sizeSearchStmt.all(...sizeParams);
      
      // Add only unique codes not already in results
      const existingCodes = new Set(relatedCodes.map(c => c.internalCode));
      for (const match of sizeMatches) {
        if (!existingCodes.has(match.internalCode)) {
          relatedCodes.push(match);
          existingCodes.add(match.internalCode);
        }
      }
    }

    // Remove duplicates based on internal code (keep first occurrence)
    const uniqueCodes = [];
    const seenCodes = new Set();
    
    for (const code of relatedCodes) {
      if (!seenCodes.has(code.internalCode)) {
        seenCodes.add(code.internalCode);
        uniqueCodes.push({
          internalCode: code.internalCode,
          customerCode: code.customerCode,
          description: code.description,
          price: parseFloat(code.price?.toFixed(2) || 0),
          customerPrice: parseFloat(code.customerPrice?.toFixed(2) || 0),
          matchType: code.matchType
        });
      }
    }

    res.json({ 
      searchParams: {
        ERPId,
        companyId,
        customerPart: customerPart || null,
        description,
        size: size || null
      },
      totalResults: uniqueCodes.length,
      relatedCodes: uniqueCodes
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search for related codes' });
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

// ============================================
// COUNTRIES AND STATES SERVICE
// ============================================

// In-memory database with countries and states
const countriesData = [
  {
    id: 1,
    code: 'US',
    name: 'Estados Unidos',
    name_en: 'United States'
  },
  {
    id: 2,
    code: 'CA',
    name: 'Canadá',
    name_en: 'Canada'
  },
  {
    id: 3,
    code: 'MX',
    name: 'México',
    name_en: 'Mexico'
  },
  {
    id: 4,
    code: 'AR',
    name: 'Argentina',
    name_en: 'Argentina'
  },
  {
    id: 5,
    code: 'CL',
    name: 'Chile',
    name_en: 'Chile'
  },
  {
    id: 6,
    code: 'CO',
    name: 'Colômbia',
    name_en: 'Colombia'
  },
  {
    id: 7,
    code: 'PE',
    name: 'Peru',
    name_en: 'Peru'
  }
];

const statesData = [
  // Estados Unidos - Todos os 50 estados
  { id: 1, ISO: 'US', code: 'AL', name: 'Alabama', capital: 'Montgomery' },
  { id: 2, ISO: 'US', code: 'AK', name: 'Alaska', capital: 'Juneau' },
  { id: 3, ISO: 'US', code: 'AZ', name: 'Arizona', capital: 'Phoenix' },
  { id: 4, ISO: 'US', code: 'AR', name: 'Arkansas', capital: 'Little Rock' },
  { id: 5, ISO: 'US', code: 'CA', name: 'California', capital: 'Sacramento' },
  { id: 6, ISO: 'US', code: 'CO', name: 'Colorado', capital: 'Denver' },
  { id: 7, ISO: 'US', code: 'CT', name: 'Connecticut', capital: 'Hartford' },
  { id: 8, ISO: 'US', code: 'DE', name: 'Delaware', capital: 'Dover' },
  { id: 9, ISO: 'US', code: 'FL', name: 'Florida', capital: 'Tallahassee' },
  { id: 10, ISO: 'US', code: 'GA', name: 'Georgia', capital: 'Atlanta' },
  { id: 11, ISO: 'US', code: 'HI', name: 'Hawaii', capital: 'Honolulu' },
  { id: 12, ISO: 'US', code: 'ID', name: 'Idaho', capital: 'Boise' },
  { id: 13, ISO: 'US', code: 'IL', name: 'Illinois', capital: 'Springfield' },
  { id: 14, ISO: 'US', code: 'IN', name: 'Indiana', capital: 'Indianapolis' },
  { id: 15, ISO: 'US', code: 'IA', name: 'Iowa', capital: 'Des Moines' },
  { id: 16, ISO: 'US', code: 'KS', name: 'Kansas', capital: 'Topeka' },
  { id: 17, ISO: 'US', code: 'KY', name: 'Kentucky', capital: 'Frankfort' },
  { id: 18, ISO: 'US', code: 'LA', name: 'Louisiana', capital: 'Baton Rouge' },
  { id: 19, ISO: 'US', code: 'ME', name: 'Maine', capital: 'Augusta' },
  { id: 20, ISO: 'US', code: 'MD', name: 'Maryland', capital: 'Annapolis' },
  { id: 21, ISO: 'US', code: 'MA', name: 'Massachusetts', capital: 'Boston' },
  { id: 22, ISO: 'US', code: 'MI', name: 'Michigan', capital: 'Lansing' },
  { id: 23, ISO: 'US', code: 'MN', name: 'Minnesota', capital: 'Saint Paul' },
  { id: 24, ISO: 'US', code: 'MS', name: 'Mississippi', capital: 'Jackson' },
  { id: 25, ISO: 'US', code: 'MO', name: 'Missouri', capital: 'Jefferson City' },
  { id: 26, ISO: 'US', code: 'MT', name: 'Montana', capital: 'Helena' },
  { id: 27, ISO: 'US', code: 'NE', name: 'Nebraska', capital: 'Lincoln' },
  { id: 28, ISO: 'US', code: 'NV', name: 'Nevada', capital: 'Carson City' },
  { id: 29, ISO: 'US', code: 'NH', name: 'New Hampshire', capital: 'Concord' },
  { id: 30, ISO: 'US', code: 'NJ', name: 'New Jersey', capital: 'Trenton' },
  { id: 31, ISO: 'US', code: 'NM', name: 'New Mexico', capital: 'Santa Fe' },
  { id: 32, ISO: 'US', code: 'NY', name: 'New York', capital: 'Albany' },
  { id: 33, ISO: 'US', code: 'NC', name: 'North Carolina', capital: 'Raleigh' },
  { id: 34, ISO: 'US', code: 'ND', name: 'North Dakota', capital: 'Bismarck' },
  { id: 35, ISO: 'US', code: 'OH', name: 'Ohio', capital: 'Columbus' },
  { id: 36, ISO: 'US', code: 'OK', name: 'Oklahoma', capital: 'Oklahoma City' },
  { id: 37, ISO: 'US', code: 'OR', name: 'Oregon', capital: 'Salem' },
  { id: 38, ISO: 'US', code: 'PA', name: 'Pennsylvania', capital: 'Harrisburg' },
  { id: 39, ISO: 'US', code: 'RI', name: 'Rhode Island', capital: 'Providence' },
  { id: 40, ISO: 'US', code: 'SC', name: 'South Carolina', capital: 'Columbia' },
  { id: 41, ISO: 'US', code: 'SD', name: 'South Dakota', capital: 'Pierre' },
  { id: 42, ISO: 'US', code: 'TN', name: 'Tennessee', capital: 'Nashville' },
  { id: 43, ISO: 'US', code: 'TX', name: 'Texas', capital: 'Austin' },
  { id: 44, ISO: 'US', code: 'UT', name: 'Utah', capital: 'Salt Lake City' },
  { id: 45, ISO: 'US', code: 'VT', name: 'Vermont', capital: 'Montpelier' },
  { id: 46, ISO: 'US', code: 'VA', name: 'Virginia', capital: 'Richmond' },
  { id: 47, ISO: 'US', code: 'WA', name: 'Washington', capital: 'Olympia' },
  { id: 48, ISO: 'US', code: 'WV', name: 'West Virginia', capital: 'Charleston' },
  { id: 49, ISO: 'US', code: 'WI', name: 'Wisconsin', capital: 'Madison' },
  { id: 50, ISO: 'US', code: 'WY', name: 'Wyoming', capital: 'Cheyenne' },
  
  // Canadá
  { id: 51, ISO: 'CA', code: 'ON', name: 'Ontario', capital: 'Toronto' },
  { id: 52, ISO: 'CA', code: 'QC', name: 'Quebec', capital: 'Quebec City' },
  { id: 53, ISO: 'CA', code: 'BC', name: 'British Columbia', capital: 'Victoria' },
  { id: 54, ISO: 'CA', code: 'AB', name: 'Alberta', capital: 'Edmonton' },
  
  // México
  { id: 55, ISO: 'MX', code: 'CMX', name: 'Ciudad de México', capital: 'Ciudad de México' },
  { id: 56, ISO: 'MX', code: 'JAL', name: 'Jalisco', capital: 'Guadalajara' },
  { id: 57, ISO: 'MX', code: 'NLE', name: 'Nuevo León', capital: 'Monterrey' },
  
  // Argentina
  { id: 58, ISO: 'AR', code: 'BA', name: 'Buenos Aires', capital: 'La Plata' },
  { id: 59, ISO: 'AR', code: 'CF', name: 'Capital Federal', capital: 'Buenos Aires' },
  { id: 60, ISO: 'AR', code: 'CO', name: 'Córdoba', capital: 'Córdoba' }
];

// ============================================
// ENDPOINTS
// ============================================

/**
 * GET /api/countries
 * Returns all countries
 */
app.get('/api/countries', (req, res) => {
  try {
    res.json({
      success: true,
      data: countriesData,
      count: countriesData.length
    });
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch countries' 
    });
  }
});

/**
 * GET /api/countries/:countryCode/states
 * Returns all states for a specific country
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'BR', 'US')
 */
app.get('/api/countries/:countryCode/states', (req, res) => {
  try {
    const countryCode = req.params.countryCode.toUpperCase();
    
    // Validate if country exists
    const country = countriesData.find(c => c.code === countryCode);
    
    if (!country) {
      return res.status(404).json({ 
        success: false,
        error: 'Country not found',
        countryCode: countryCode
      });
    }
    
    // Get states for the country
    const states = statesData.filter(s => s.ISO === countryCode);
    
    res.json({
      success: true,
      country: {
        code: country.code,
        name: country.name,
        name_en: country.name_en
      },
      data: states,
      count: states.length
    });
  } catch (error) {
    console.error('Error fetching states:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch states' 
    });
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