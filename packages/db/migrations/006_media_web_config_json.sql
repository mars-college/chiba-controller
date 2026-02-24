ALTER TABLE media_resources
  ADD COLUMN IF NOT EXISTS web_config_json JSONB;

