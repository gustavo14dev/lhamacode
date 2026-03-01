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

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);

-- 4. Políticas de segurança (RLS - Row Level Security)
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

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

-- 5. Trigger para atualizar updated_at automaticamente
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

-- 6. Tabela de Preferências do Usuário (opcional, para futuro)
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para user_preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- RLS para user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences" ON user_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Trigger para updated_at em user_preferences
CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Função útil para limpeza (opcional)
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
