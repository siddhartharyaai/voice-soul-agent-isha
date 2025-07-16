-- Fix the user creation trigger to use correct field names
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, email, name, google_auth)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    CASE WHEN NEW.raw_user_meta_data->>'provider' = 'google' THEN true ELSE false END
  );
  
  -- Create default bot for new user
  INSERT INTO public.bots (user_id, name, personality)
  VALUES (
    NEW.id,
    'Isha',
    'I am Isha, your helpful AI assistant. I''m friendly, knowledgeable, and here to help you with various tasks.'
  );
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();