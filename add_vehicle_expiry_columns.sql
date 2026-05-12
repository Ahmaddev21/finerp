-- Add vehicle-specific expiry date columns to deliveries table
-- bike_expiry: tracks Rider (Bike) registration/insurance expiry
-- car_expiry:  tracks Driver (Car) registration/insurance expiry
ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS bike_expiry DATE,
ADD COLUMN IF NOT EXISTS car_expiry DATE;
