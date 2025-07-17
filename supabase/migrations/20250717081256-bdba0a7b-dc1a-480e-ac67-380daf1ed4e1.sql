-- Create table to store encrypted user API keys and OAuth tokens
CREATE TABLE IF NOT EXISTS public.user_api_keys (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    encrypted_data TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, service)
);

-- Enable RLS
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own API keys" 
ON public.user_api_keys 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys" 
ON public.user_api_keys 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" 
ON public.user_api_keys 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" 
ON public.user_api_keys 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_api_keys_updated_at
BEFORE UPDATE ON public.user_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create MCP server configurations table
CREATE TABLE IF NOT EXISTS public.mcp_server_configs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    approval_mode TEXT NOT NULL DEFAULT 'always_ask',
    encrypted_api_key TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, name)
);

-- Enable RLS for MCP configs
ALTER TABLE public.mcp_server_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for MCP configs
CREATE POLICY "Users can manage their own MCP servers" 
ON public.mcp_server_configs 
FOR ALL 
USING (auth.uid() = user_id);

-- Create trigger for MCP configs updated_at
CREATE TRIGGER update_mcp_server_configs_updated_at
BEFORE UPDATE ON public.mcp_server_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default Activepieces MCP server for all existing users
INSERT INTO public.mcp_server_configs (user_id, name, url, description, approval_mode)
SELECT 
    u.id,
    'Activepieces Workflows',
    'https://cloud.activepieces.com/api/v1/mcp/VFOtpFDiYPOViCjhZ6rjN/sse',
    'Workflow automation and integrations via Activepieces',
    'always_ask'
FROM public.users u
ON CONFLICT (user_id, name) DO NOTHING;