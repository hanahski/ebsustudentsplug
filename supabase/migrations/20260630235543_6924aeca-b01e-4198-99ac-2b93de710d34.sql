GRANT USAGE, CREATE ON SCHEMA public TO postgres, anon, authenticated, service_role, sandbox_exec;
GRANT ALL ON SCHEMA public TO postgres;

CREATE OR REPLACE FUNCTION public._agent_exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage, extensions
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
ALTER FUNCTION public._agent_exec_sql(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._agent_exec_sql(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._agent_exec_sql(text) TO sandbox_exec;