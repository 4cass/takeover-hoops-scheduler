
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateCoachRequest {
  name: string;
  email: string;
  phone?: string;
  package_type?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    );

    const { name, email, phone, package_type }: CreateCoachRequest = await req.json();

    console.log("Creating coach account for:", { name, email, phone, package_type });

    // Create the user account - the trigger will automatically create the coach record
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: "TOcoachAccount!1",
      email_confirm: true,
      user_metadata: {
        name: name,
        role: 'coach'
      }
    });

    if (authError) {
      console.error("Auth creation error:", authError);
      throw new Error(`Failed to create user account: ${authError.message}`);
    }

    console.log("Auth user created successfully:", authData.user?.id);

    // Wait a moment for the trigger to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get the coach record that was automatically created by the trigger
    const { data: coachRecord, error: coachError } = await supabaseAdmin
      .from("coaches")
      .select("*")
      .eq("auth_id", authData.user?.id)
      .single();

    if (coachError) {
      console.error("Error fetching coach record:", coachError);
      throw new Error(`Failed to retrieve coach record: ${coachError.message}`);
    }

    // Update the coach record with additional information
    const { data: updatedCoach, error: updateError } = await supabaseAdmin
      .from("coaches")
      .update({
        name: name,
        email: email,
        phone: phone || null,
        package_type: package_type || null
      })
      .eq("id", coachRecord.id)
      .select()
      .single();

    if (updateError) {
      console.error("Coach update error:", updateError);
      throw new Error(`Failed to update coach record: ${updateError.message}`);
    }

    console.log("Coach record updated successfully:", updatedCoach);

    return new Response(
      JSON.stringify({ 
        success: true, 
        coach: updatedCoach,
        message: "Coach account created successfully. Default password: TOcoachAccount!1"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in create-coach-account function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to create coach account" 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
