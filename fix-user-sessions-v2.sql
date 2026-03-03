-- Corrigir permissão da tabela user_sessions
-- Execute isso no SQL Editor do Supabase

-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "Users can manage own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Admin can view all sessions" ON user_sessions;

-- Criar política única e simplificada para todas as operações
CREATE POLICY "Users can manage own sessions" ON user_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Habilitar RLS (Row Level Security) na tabela
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Garantir que a tabela existe com a estrutura correta
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_data JSONB DEFAULT '{}'::jsonb
);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

-- Política para permitir inserção (sem verificação de user_id no INSERT)
CREATE POLICY "Enable insert for authenticated users" ON user_sessions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Política para permitir seleção própria
CREATE POLICY "Enable select for own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- Política para permitir atualização própria
CREATE POLICY "Enable update for own sessions" ON user_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Política para permitir deleção própria
CREATE POLICY "Enable delete for own sessions" ON user_sessions
    FOR DELETE USING (auth.uid() = user_id);
