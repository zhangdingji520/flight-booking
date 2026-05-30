/*
  # Initial Schema for Flight Booking Platform

  1. New Tables
    - `users` — User accounts with role-based access
    - `flights` — Flight information and seat availability
    - `orders` — Booking orders with passenger details
    - `notifications` — User notifications for flight updates

  2. Security
    - Enable RLS on all tables
    - Users can only access their own data
    - Admins have full access to all data
*/

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  real_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Flights table
CREATE TABLE IF NOT EXISTS flights (
  id TEXT PRIMARY KEY,
  flight_no TEXT NOT NULL,
  airline TEXT NOT NULL,
  departure TEXT NOT NULL,
  arrival TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  arrival_time TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL CHECK (price > 0),
  total_seats INTEGER NOT NULL CHECK (total_seats > 0),
  available_seats INTEGER NOT NULL CHECK (available_seats >= 0),
  aircraft TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'on-time' CHECK (status IN ('on-time', 'delayed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flight_id TEXT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  flight_no TEXT NOT NULL,
  airline TEXT NOT NULL,
  departure TEXT NOT NULL,
  arrival TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  arrival_time TEXT NOT NULL,
  passengers JSONB NOT NULL,
  total_price DECIMAL(10,2) NOT NULL CHECK (total_price > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price > 0),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'completed', 'cancelled', 'refunded', 'refund_pending')),
  refund_reason TEXT,
  refund_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all users"
  ON users FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Flights policies (public read, admin write)
CREATE POLICY "Anyone can view flights"
  ON flights FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage flights"
  ON flights FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Orders policies
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_flight_id ON orders(flight_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_flights_departure ON flights(departure);
CREATE INDEX IF NOT EXISTS idx_flights_arrival ON flights(arrival);
CREATE INDEX IF NOT EXISTS idx_flights_status ON flights(status);
