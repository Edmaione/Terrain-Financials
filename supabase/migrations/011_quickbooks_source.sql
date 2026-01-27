-- Add 'quickbooks' to source_system enum
ALTER TYPE source_system ADD VALUE IF NOT EXISTS 'quickbooks';
