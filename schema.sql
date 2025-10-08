-- Database Schema for Order Management System (SQLite)

-- Customer Table
CREATE TABLE Customer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Store Table
CREATE TABLE Store (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    store_name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customer(id) ON DELETE CASCADE
);

-- CSR (Customer Service Representative) Table
CREATE TABLE CSR (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    customer_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customer(id) ON DELETE CASCADE
);

-- Order Status Table
CREATE TABLE OrderStatus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status_name TEXT UNIQUE NOT NULL,
    description TEXT
);

-- Orders Table
CREATE TABLE Orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    order_number TEXT UNIQUE NOT NULL,
    status_id INTEGER NOT NULL,
    total_amount REAL DEFAULT 0.00,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customer(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES OrderStatus(id)
);

-- Part Status Table
CREATE TABLE PartStatus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status_name TEXT UNIQUE NOT NULL,
    description TEXT
);

-- Substrate Table (for dropdown)
CREATE TABLE Substrate (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

-- Finish Table (for dropdown)
CREATE TABLE Finish (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

-- Part Table
CREATE TABLE Part (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    internal_code TEXT UNIQUE NOT NULL,
    description TEXT,
    base_price REAL NOT NULL,
    substrate_id INTEGER NOT NULL,
    finish_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (substrate_id) REFERENCES Substrate(id),
    FOREIGN KEY (finish_id) REFERENCES Finish(id)
);

-- Part Mapping Table (Customer-specific part codes)
CREATE TABLE PartMapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    customer_code TEXT NOT NULL,
    price_override REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (customer_id, customer_code),
    FOREIGN KEY (part_id) REFERENCES Part(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES Customer(id) ON DELETE CASCADE
);

-- Order Parts (Junction Table)
CREATE TABLE OrderPart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    part_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    status_id INTEGER NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES Part(id),
    FOREIGN KEY (status_id) REFERENCES PartStatus(id)
);

-- =====================
-- SAMPLE DATA INSERTS
-- =====================

-- Insert Order Statuses
INSERT INTO OrderStatus (status_name, description) VALUES
('Pending', 'Order received, awaiting processing'),
('In Production', 'Order is being manufactured'),
('Ready to Ship', 'Order completed, ready for shipment'),
('Shipped', 'Order has been shipped'),
('Delivered', 'Order delivered to customer'),
('Cancelled', 'Order cancelled');

-- Insert Part Statuses
INSERT INTO PartStatus (status_name, description) VALUES
('Pending', 'Part not yet started'),
('In Production', 'Part being manufactured'),
('Quality Check', 'Part undergoing quality inspection'),
('Completed', 'Part finished'),
('On Hold', 'Part production paused'),
('Rejected', 'Part failed quality check');

-- Insert Substrates
INSERT INTO Substrate (name, description) VALUES
('Aluminum', 'Lightweight aluminum substrate'),
('Steel', 'Heavy-duty steel substrate'),
('Plastic', 'Durable plastic substrate'),
('Acrylic', 'Clear acrylic substrate'),
('Wood', 'Natural wood substrate');

-- Insert Finishes
INSERT INTO Finish (name, description) VALUES
('Matte', 'Non-reflective matte finish'),
('Glossy', 'High-gloss reflective finish'),
('Brushed', 'Brushed metal finish'),
('Powder Coated', 'Durable powder coat finish'),
('Anodized', 'Anodized metal finish');

-- Insert Customers
INSERT INTO Customer (name, email, phone) VALUES
('TechMart Inc', 'contact@techmart.com', '+1-555-0101'),
('Global Electronics', 'sales@globalelec.com', '+1-555-0102'),
('Smart Devices Co', 'info@smartdevices.com', '+1-555-0103');

-- Insert Stores
INSERT INTO Store (customer_id, store_name, address, city, state, zip_code) VALUES
(1, 'TechMart Downtown', '123 Main St', 'New York', 'NY', '10001'),
(1, 'TechMart Uptown', '456 Broadway', 'New York', 'NY', '10002'),
(2, 'Global Electronics HQ', '789 Tech Ave', 'San Francisco', 'CA', '94102'),
(3, 'Smart Devices Warehouse', '321 Innovation Dr', 'Austin', 'TX', '78701');

-- Insert CSRs
INSERT INTO CSR (name, email, phone, customer_id) VALUES
('John Smith', 'john.smith@techmart.com', '+1-555-1001', 1),
('Sarah Johnson', 'sarah.j@techmart.com', '+1-555-1002', 1),
('Mike Chen', 'mike.chen@globalelec.com', '+1-555-1003', 2),
('Emily Davis', 'emily.d@smartdevices.com', '+1-555-1004', 3);

-- =====================
-- EXTENDED PARTS DATA
-- =====================

-- Insert More Parts (adiciona aos 5 existentes)
INSERT INTO Part (internal_code, description, base_price, substrate_id, finish_id) VALUES
-- TVs & Monitors
('T456', 'TV 43" LG QLED Display', 399.99, 1, 2),
('T567', 'TV 55" Sony OLED 4K', 699.99, 4, 2),
('T678', 'TV 65" Samsung Neo QLED', 899.99, 1, 5),
('M567', 'Monitor 32" Gaming 144Hz', 349.99, 1, 1),
('M678', 'Monitor 27" 4K IPS Professional', 499.99, 1, 3),
('M789', 'Monitor 24" Full HD Office', 159.99, 1, 1),

-- Smartphones & Tablets
('S890', 'Smartphone AMOLED Screen 6.7"', 199.99, 4, 2),
('S901', 'Smartphone LCD Screen 6.1"', 89.99, 3, 1),
('S012', 'Smartphone Foldable Display 7.6"', 449.99, 4, 2),
('T345', 'Tablet Display 12.9" Pro', 249.99, 4, 2),
('T457', 'Tablet Display 8" Kids Edition', 69.99, 3, 4),
('T568', 'Tablet E-Reader Display 7"', 79.99, 3, 1),

-- Wearables
('W456', 'Smartwatch Display 1.7" Sport', 59.99, 3, 2),
('W567', 'Smartwatch Display 1.9" Premium', 89.99, 4, 5),
('W678', 'Fitness Band Display 0.96"', 29.99, 3, 1),
('W789', 'Smart Ring LED Display', 39.99, 1, 5),

-- Automotive Displays
('A123', 'Car Dashboard Display 10.25"', 329.99, 1, 3),
('A234', 'Car Center Console Screen 12.3"', 449.99, 4, 2),
('A345', 'Rear Seat Entertainment 11.6"', 279.99, 3, 1),
('A456', 'Digital Rearview Mirror Display', 189.99, 4, 1),

-- Industrial & Commercial
('I123', 'Industrial Touch Panel 15.6"', 399.99, 2, 4),
('I234', 'Point of Sale Display 10.1"', 159.99, 1, 1),
('I345', 'Digital Signage Screen 42"', 549.99, 1, 3),
('I456', 'Kiosk Touchscreen 21.5"', 329.99, 2, 4),
('I567', 'ATM Display 12.1" Vandal Proof', 449.99, 2, 4),

-- Medical & Specialized
('D123', 'Medical Imaging Display 21"', 899.99, 1, 1),
('D234', 'Dental X-Ray Screen 19"', 649.99, 1, 1),
('D345', 'Patient Monitor Display 15"', 529.99, 3, 1),

-- Gaming & VR
('G123', 'Gaming Laptop Display 17.3"', 299.99, 1, 1),
('G234', 'Portable Gaming Console 7"', 149.99, 4, 2),
('G345', 'VR Headset Display Dual 4K', 699.99, 4, 1),
('G456', 'Handheld Gaming Device 5.5"', 119.99, 4, 2),

-- Smart Home
('H123', 'Smart Home Hub Display 7"', 89.99, 3, 2),
('H234', 'Smart Mirror Display 32"', 449.99, 4, 2),
('H345', 'Smart Refrigerator Screen 21.5"', 349.99, 1, 3),
('H456', 'Smart Thermostat Display 3.5"', 49.99, 3, 1);

-- Insert Part Mappings (Customer-specific codes)
INSERT INTO PartMapping (part_id, customer_id, customer_code, price_override) VALUES
-- TechMart Inc (customer_id = 1) mappings
(6, 1, 'TM-TV43-LG', 379.99),
(7, 1, 'TM-TV55-SONY', 679.99),
(8, 1, 'TM-TV65-SAM', 869.99),
(9, 1, 'TM-MON32-GAME', 329.99),
(10, 1, 'TM-MON27-4K', 479.99),
(11, 1, 'TM-MON24-OFF', 149.99),
(12, 1, 'TM-PHONE67', 189.99),
(13, 1, 'TM-PHONE61', 84.99),
(15, 1, 'TM-TAB129', 239.99),
(16, 1, 'TM-TAB8-KIDS', 64.99),
(18, 1, 'TM-WATCH17', 54.99),
(19, 1, 'TM-WATCH19', 84.99),
(27, 1, 'TM-LAPTOP173', 289.99),
(28, 1, 'TM-CONSOLE7', 139.99),
(30, 1, 'TM-HANDHELD55', 109.99),
(31, 1, 'TM-SMARTHUB7', 84.99),

-- Global Electronics (customer_id = 2) mappings
(6, 2, 'GE-TV43-001', 389.99),
(7, 2, 'GE-TV55-002', 689.99),
(8, 2, 'GE-TV65-003', NULL), -- usando preço base
(9, 2, 'GE-MON32-001', 339.99),
(10, 2, 'GE-MON27-002', 489.99),
(12, 2, 'GE-PHN67-001', 194.99),
(14, 2, 'GE-FOLD76-001', 439.99),
(15, 2, 'GE-TAB129-001', 244.99),
(21, 2, 'GE-AUTO-DASH', 319.99),
(22, 2, 'GE-AUTO-CENTER', 439.99),
(23, 2, 'GE-AUTO-REAR', 269.99),
(25, 2, 'GE-INDUST15', 389.99),
(26, 2, 'GE-POS101', 149.99),
(27, 2, 'GE-SIGN42', 539.99),
(29, 2, 'GE-ATM121', NULL),

-- Smart Devices Co (customer_id = 3) mappings
(11, 3, 'SD-MON24-A', 154.99),
(12, 3, 'SD-PHN67-PRO', 192.99),
(13, 3, 'SD-PHN61-LITE', 87.99),
(14, 3, 'SD-FOLD-ULTRA', 445.00),
(16, 3, 'SD-TAB8-K', 67.99),
(17, 3, 'SD-EREADER7', 76.99),
(18, 3, 'SD-WATCH17-S', 57.99),
(19, 3, 'SD-WATCH19-P', 87.99),
(20, 3, 'SD-BAND096', 27.99),
(21, 3, 'SD-RING-LED', 37.99),
(28, 3, 'SD-CONSOLE7-G', 142.99),
(29, 3, 'SD-VR-4K', 689.99),
(30, 3, 'SD-HANDHELD', 115.00),
(31, 3, 'SD-HUB-HOME', 87.99),
(32, 3, 'SD-MIRROR-32', 439.99),
(33, 3, 'SD-FRIDGE-215', 339.99),
(34, 3, 'SD-THERMO-35', 46.99),

-- Multiple customers for popular items
(7, 3, 'SD-TV55-OLED', 695.00),
(8, 3, 'SD-TV65-NEO', 889.99),
(10, 3, 'SD-MON27-4K', 494.99),
(21, 1, 'TM-CAR-DASH', 324.99),
(22, 3, 'SD-CAR-CENTER', 444.99),
(26, 1, 'TM-POS-101', 154.99),
(26, 3, 'SD-POS-TOUCH', 157.99),
(31, 2, 'GE-SMARTHUB-7', 87.99),
(32, 1, 'TM-MIRROR-SMART', 444.99),
(32, 2, 'GE-MIRROR-32', NULL),
(33, 2, 'GE-FRIDGE-SCR', 344.99);

-- Insert Orders
INSERT INTO Orders (customer_id, order_number, status_id, total_amount) VALUES
(1, 'ORD-2025-001', 2, 869.97),
(1, 'ORD-2025-002', 1, 459.98),
(2, 'ORD-2025-003', 3, 590.00),
(3, 'ORD-2025-004', 1, 242.99);

-- Insert Order Parts
INSERT INTO OrderPart (order_id, part_id, quantity, unit_price, status_id, notes) VALUES
(1, 1, 2, 289.99, 2, 'Priority order'),
(1, 2, 1, 179.99, 2, NULL),
(2, 4, 3, 94.99, 1, NULL),
(2, 2, 1, 179.99, 1, NULL),
(3, 1, 2, 295.00, 3, 'Ready for pickup'),
(4, 3, 1, 145.00, 1, NULL),
(4, 5, 2, 47.99, 1, 'Urgent - expedite if possible');