/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
    // 1. Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    try {
        console.log("Edge Function Request Received");

        // 2. Parse Body First (to get action)
        const body = await req.json().catch(() => ({}))
        const { action, ...payload } = body
        console.log(`Action: ${action}`);

        // 3. Prepare Clients
        const supabaseAnon = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 4. Verify Auth
        const { data: authData, error: authError } = await supabaseAnon.auth.getUser()

        if (authError || !authData.user) {
            console.error("Auth Fail:", authError);
            return new Response(
                JSON.stringify({ error: `Unauthorized: ${authError?.message || 'No User'}` }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
        const user = authData.user;

        // 5. Admin Role Check
        const { data: appUser, error: roleError } = await supabaseAdmin
            .from('app_users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (roleError || !appUser) {
            console.error('Role Check Failed:', roleError);
            return new Response(
                JSON.stringify({ error: `Unauthorized: User not found in database.` }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const userRole = (appUser.role || '').trim().toLowerCase();
        if (userRole !== 'admin') {
            return new Response(
                JSON.stringify({ error: `Unauthorized: Admin role required. Found: '${userRole}'` }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 6. Handle Actions
        if (action === 'create_user') {
            const { email, password, full_name, role } = payload
            console.log(`Creating user: ${email}`);

            // A. Create in Auth
            let authUser;
            const { data: createdData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name }
            })

            if (createError) {
                // If user exists, try to find them to get ID (for sync)
                if (createError.message.includes("already registered")) {
                    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
                    const existing = existingUsers?.users.find(u => u.email === email);
                    if (existing) {
                        authUser = existing;
                        // Optional: Update password
                        if (password) await supabaseAdmin.auth.admin.updateUserById(existing.id, { password, user_metadata: { full_name } });
                    } else {
                        throw createError;
                    }
                } else {
                    throw createError;
                }
            } else {
                authUser = createdData.user;
            }

            // B. Return result (Sync happens on frontend or via triggers usually, but frontend requested handling here?)
            // The frontend does the upsert. We just need to return the Auth User.

            return new Response(
                JSON.stringify({ success: true, user: authUser }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (action === 'change_password') {
            const { user_id, password, email } = payload
            console.log(`Resetting password for User ID: ${user_id}, Email: ${email}`);

            const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });

            if (error) {
                console.error("Update User Error:", error);
                if (error.message.includes("User not found")) {
                    return new Response(
                        JSON.stringify({ error: `UserSyncError: User ${user_id} not found in Auth. Please recreate.` }),
                        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }
                throw error
            }

            return new Response(
                JSON.stringify({ success: true, user: data.user }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ error: `Unknown action: ${action}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error("Internal Error:", error);
        return new Response(
            JSON.stringify({ error: `INTERNAL ERROR: ${errorMessage}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
