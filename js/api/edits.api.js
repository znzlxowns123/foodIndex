import { supabase } from './supabaseClient.js'

export async function submitPlaceEdit({ manageNo, fieldName, newValue, editorKey }) {
  const { error } = await supabase
    .from('place_info_edits')
    .insert({
      place_manage_no: manageNo,
      field_name: fieldName,
      new_value: newValue,
      editor_key: editorKey,
      editor_level: 'anon',
      status: 'pending'
    })

  if (error) throw error
}
