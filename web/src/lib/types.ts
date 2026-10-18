export type PublicPackage = {
  id: string
  slug: string
  title: string
  description: string | null
  destination_id: string | null
  destination_slug: string | null
  destination_name: string | null
  departure_city: string | null
  pickup_point: string | null
  drop_point: string | null
  duration_days: number | null
  nights: number | null
  price_paise: number
  occupancy_basis: string | null
  price_includes_taxes: boolean
  inclusions: string[]
  exclusions: string[]
  itinerary: { day?: number; title?: string; description?: string }[] | null
  hotel_details: string | null
  meal_plan: string | null
  vehicle_type: string | null
  min_group: number | null
  max_group: number | null
  child_policy: string | null
  difficulty_level: string | null
  high_risk_activities: boolean
  insurance_provided: boolean
  insurance_details: string | null
  cancellation_policy: string | null
  photos: string[]
  rating_avg: number | null
  review_count: number
  seller_id: string
  seller_name: string
  seller_city: string | null
  seller_verified: boolean
  next_departure_date: string | null
}

export type PublicDeparture = {
  id: string
  package_id: string
  departure_date: string
  return_date: string | null
  price_paise: number
  seats_left: number
}

export type PublicDestination = { id: string; slug: string; name: string; state: string | null; package_count: number }

export type SellerRow = {
  id: string
  user_id: string
  business_name: string
  contact_name: string
  email: string
  phone: string
  whatsapp: string | null
  city: string | null
  state: string | null
  pincode: string | null
  address: string | null
  description: string | null
  gstin: string | null
  pan: string | null
  bank_account_name: string | null
  bank_account_number: string | null
  bank_ifsc: string | null
  bank_name: string | null
  cancelled_cheque_path: string | null
  owner_id_type: string | null
  owner_id_path: string | null
  travel_registration_number: string | null
  travel_registration_path: string | null
  gstin_verified: boolean
  pan_verified: boolean
  bank_verified: boolean
  address_verified: boolean
  owner_id_verified: boolean
  verification_notes: string | null
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | 'banned'
  status_note: string | null
  created_at: string
}
