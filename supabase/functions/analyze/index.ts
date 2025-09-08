// Supabase Edge Function: analyze
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  const startTime = Date.now();
  let requestId: string;
  
  try {
    const payload = await req.json()
    requestId = payload.request_id || crypto.randomUUID();
    const aiUrl = Deno.env.get('AI_SERVICE_URL') || 'http://127.0.0.1:8000/analyze'
    const shared = Deno.env.get('EDGE_SHARED_SECRET') || ''
    
    const log = (level: string, message: string, details?: any) => {
      const duration = Date.now() - startTime;
      const logEntry = { 
        level, 
        requestId, 
        message, 
        details: { ...details, duration }, 
        timestamp: new Date().toISOString() 
      };
      console.log(JSON.stringify(logEntry));
    };
    
    log('info', 'Edge Function request received', { 
      projectId: payload.project_id, 
      ifcPath: payload.ifc_file_path 
    });
    const aiStartTime = Date.now();
    log('info', 'Calling AI service', { aiUrl });
    
    const res = await fetch(aiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-shared-secret': shared,
        'x-request-id': requestId, // Pass request ID to AI service
      },
      body: JSON.stringify({ ...payload, request_id: requestId })
    })
    
    const aiDuration = Date.now() - aiStartTime;
    log('info', 'AI service response received', { 
      status: res.status, 
      aiDuration,
      success: res.ok 
    });
    
    const data = await res.json()

    // Optional: store generated PDF report into Storage 'reports' bucket
    try {
      if (data?.report?.content_b64 && data?.report?.filename) {
        const baseUrl = Deno.env.get('COBBLE_SUPABASE_URL') || 'http://host.docker.internal:54321'
        const bucket = 'reports'
        const objectPath = `${payload.project_id}/${data.report.filename}`
        const serviceKey = Deno.env.get('COBBLE_SERVICE_KEY') || ''
        const anonKey = Deno.env.get('COBBLE_ANON_KEY') || ''
        const incomingAuth = req.headers.get('authorization') || ''
        const headers: Record<string, string> = {
          'content-type': data.report.content_type || 'application/pdf',
          'x-upsert': 'true'
        }
        if (serviceKey) {
          headers['Authorization'] = `Bearer ${serviceKey}`
          headers['apikey'] = serviceKey
        } else if (incomingAuth) {
          headers['Authorization'] = incomingAuth
          if (anonKey) headers['apikey'] = anonKey
        }
        const storageRes = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
          method: 'PUT',
          headers,
          body: Uint8Array.from(atob(data.report.content_b64), c => c.charCodeAt(0))
        })
        if (!storageRes.ok) {
          const txt = await storageRes.text()
          console.error('[analyze] Report upload failed', storageRes.status, txt)
        } else {
          console.log('[analyze] Report upload ok', storageRes.status)
        }
        // overwrite filename to canonical path used in Storage
        data.report_path = `${bucket}/${objectPath}`
      }
    } catch (_e) {}
    // Persist mock results to design_outputs
    try {
      const restUrl = Deno.env.get('COBBLE_SUPABASE_URL') || 'http://host.docker.internal:54321'
      const serviceKey = Deno.env.get('COBBLE_SERVICE_KEY') || ''
      const anonKey = Deno.env.get('COBBLE_ANON_KEY') || ''
      const incomingAuth = req.headers.get('authorization') || ''

      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      }
      if (serviceKey) {
        headers['apikey'] = serviceKey
        headers['Authorization'] = `Bearer ${serviceKey}`
      } else if (incomingAuth) {
        // Fall back to the caller's JWT (from supabase-js invoke) for RLS policies
        headers['Authorization'] = incomingAuth
        if (anonKey) headers['apikey'] = anonKey
      }

      console.log('[analyze] Persisting to design_outputs', {
        restUrl,
        usingServiceKey: Boolean(serviceKey),
        usingCallerJwt: Boolean(!serviceKey && incomingAuth)
      })

      const upsertUrl = `${restUrl}/rest/v1/design_outputs?on_conflict=project_id`
      const payloadBody = {
        project_id: payload.project_id,
        results: data.results,
        analysis_duration_seconds: data.analysis_duration_seconds || null,
        report_path: data?.report_path || (data?.report?.filename ? `reports/${payload.project_id}/${data.report.filename}` : null),
        overall_compliance: data.results?.overall_compliance ?? null,
        element_count: data.results?.elements?.length ?? null,
        max_utilization: data.results?.elements?.reduce((m: number, e: any) => Math.max(m, e.max_utilization || 0), 0) ?? null
      }

      let persistRes = await fetch(upsertUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadBody)
      })
      if (!persistRes.ok) {
        if (persistRes.status === 409) {
          // Fallback: explicit update by project_id
          const patchUrl = `${restUrl}/rest/v1/design_outputs?project_id=eq.${encodeURIComponent(payload.project_id)}`
          const { project_id, ...updateBody } = payloadBody as any
          const patchRes = await fetch(patchUrl, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(updateBody)
          })
          if (!patchRes.ok) {
            const text = await patchRes.text()
            console.error('[analyze] Patch failed', patchRes.status, text)
          } else {
            console.log('[analyze] Patch ok', patchRes.status)
          }
        } else {
          const text = await persistRes.text()
          console.error('[analyze] Persist failed', persistRes.status, text)
        }
      } else {
        console.log('[analyze] Persist ok', persistRes.status)
      }
    } catch (_e) {
      // Ignore persistence errors for MVP
    }
    // Write a structured analysis log
    try {
      const restUrl = Deno.env.get('COBBLE_SUPABASE_URL') || 'http://host.docker.internal:54321'
      const serviceKey = Deno.env.get('COBBLE_SERVICE_KEY') || ''
      const anonKey = Deno.env.get('COBBLE_ANON_KEY') || ''
      const incomingAuth = req.headers.get('authorization') || ''
      const headers: Record<string, string> = {
        'content-type': 'application/json'
      }
      if (serviceKey) {
        headers['apikey'] = serviceKey
        headers['Authorization'] = `Bearer ${serviceKey}`
      } else if (incomingAuth) {
        headers['Authorization'] = incomingAuth
        if (anonKey) headers['apikey'] = anonKey
      }
      await fetch(`${restUrl}/rest/v1/analysis_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          project_id: payload.project_id,
          log_level: 'INFO',
          message: 'Analysis completed',
          details: { 
            requestId,
            analysis_id: data.analysis_id, 
            duration_s: data.analysis_duration_seconds,
            edge_function_duration: Date.now() - startTime
          }
        })
      })
    } catch {}
    log('info', 'Edge Function completed successfully', { 
      totalDuration: Date.now() - startTime,
      analysisId: data.analysis_id 
    });
    
    return new Response(JSON.stringify({ success: true, analysis_id: data.analysis_id }), { headers: { 'content-type': 'application/json', ...corsHeaders } })
  } catch (e) {
    const errorDuration = Date.now() - startTime;
    console.error(JSON.stringify({
      level: 'error',
      requestId: requestId || 'unknown',
      message: 'Edge Function error',
      details: { 
        error: String(e?.message || e),
        duration: errorDuration 
      },
      timestamp: new Date().toISOString()
    }));
    
    return new Response(
      JSON.stringify({ success: false, error: String(e?.message || e) }),
      { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders } }
    )
  }
})


