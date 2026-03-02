-- Configuração do banco de dados para o Lhama Code
-- Execute este SQL no painel SQL do seu projeto Supabase

-- 1. Habilitar extensão para autenticação (já vem habilitada por padrão)
-- Não necessário, já está ativo no Supabase

-- 2. Tabela de Chats dos Usuários
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    messages JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Feedback das Respostas
CREATE TABLE IF NOT EXISTS feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    feedback_type TEXT CHECK (feedback_type IN ('like', 'dislike')),
    comment TEXT,
    response_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Sessões Ativas (para usuários online)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen ON user_sessions(last_seen DESC);

-- 5. Políticas de segurança (RLS - Row Level Security)
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes antes de criar novas
DROP POLICY IF EXISTS "Users can view own chats" ON chats;
DROP POLICY IF EXISTS "Users can insert own chats" ON chats;
DROP POLICY IF EXISTS "Users can update own chats" ON chats;
DROP POLICY IF EXISTS "Users can delete own chats" ON chats;
DROP POLICY IF EXISTS "Users can view own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can insert own feedback" ON feedback;
DROP POLICY IF EXISTS "Admin can view all feedback" ON feedback;
DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can manage own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Admin can view all sessions" ON user_sessions;

-- Política: Usuários só podem ver seus próprios chats
CREATE POLICY "Users can view own chats" ON chats
    FOR SELECT USING (auth.uid() = user_id);

-- Política: Usuários só podem inserir seus próprios chats
CREATE POLICY "Users can insert own chats" ON chats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política: Usuários só podem atualizar seus próprios chats
CREATE POLICY "Users can update own chats" ON chats
    FOR UPDATE USING (auth.uid() = user_id);

-- Política: Usuários só podem deletar seus próprios chats
CREATE POLICY "Users can delete own chats" ON chats
    FOR DELETE USING (auth.uid() = user_id);

-- 6. Políticas de Feedback
-- Política: Usuários só podem ver seus próprios feedbacks
CREATE POLICY "Users can view own feedback" ON feedback
    FOR SELECT USING (auth.uid() = user_id);

-- Política: Usuários só podem inserir seus próprios feedbacks
CREATE POLICY "Users can insert own feedback" ON feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política: Admin pode ver todos os feedbacks
CREATE POLICY "Admin can view all feedback" ON feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.email = 'gustavo14dev@gmail.com'
        )
    );

-- 7. Políticas de Sessões
-- Política: Usuários só podem gerenciar suas próprias sessões
CREATE POLICY "Users can manage own sessions" ON user_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Política: Admin pode ver todas as sessões
CREATE POLICY "Admin can view all sessions" ON user_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.email = 'gustavo14dev@gmail.com'
        )
    );

-- 7. Trigger para atualizar updated_at automaticamente
-- Remover trigger existente antes de criar
DROP TRIGGER IF EXISTS update_chats_updated_at ON chats;
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chats_updated_at 
    BEFORE UPDATE ON chats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Função para limpar sessões antigas
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions 
    WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ language 'plpgsql';

-- 9. Função útil para limpeza (opcional)
CREATE OR REPLACE FUNCTION cleanup_old_chats()
RETURNS void AS $$
BEGIN
    DELETE FROM chats 
    WHERE updated_at < NOW() - INTERVAL '1 year'
    AND user_id NOT IN (
        SELECT user_id FROM (
            SELECT user_id, MAX(updated_at) as last_activity
            FROM chats 
            GROUP BY user_id
            HAVING MAX(updated_at) < NOW() - INTERVAL '6 months'
        ) inactive_users
    );
END;
$$ LANGUAGE plpgsql;

-- 8. Permitir que usuários anônimos acessem o schema público (não recomendado para produção)
-- Descomente apenas se necessário para desenvolvimento
-- GRANT USAGE ON SCHEMA public TO anon;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;

-- 9. Configuração de CORS (via painel do Supabase)
-- Vá para Settings > API e adicione seu domínio em:
-- Additional Origins: http://localhost:8000, https://seu-dominio.com

-- 10. Teste de inserção (remover após testes)
-- INSERT INTO chats (id, user_id, title, messages) 
-- VALUES ('test-chat-123', auth.uid(), 'Chat de Teste', '[{"role": "user", "content": "Olá!"}]');

COMMIT;
