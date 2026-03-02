-- Verificar se as tabelas existem
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verificar se as políticas RLS existem
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- Verificar usuários cadastrados
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC;

-- Verificar chats existentes
SELECT id, user_id, title, created_at, updated_at 
FROM chats 
ORDER BY updated_at DESC;
