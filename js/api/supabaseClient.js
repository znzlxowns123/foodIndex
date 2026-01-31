// js/api/supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

export const supabase = createClient(
  'https://lkapnlhzhokrdzgaperc.supabase.co',
  'sb_publishable_qy47lvrCL6m2u-D_50XPJQ_ph6S-HMZ'
)

window.supabase = supabase
